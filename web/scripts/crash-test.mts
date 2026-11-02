// Exactly-once under crashes: a writer appends 1,000 events in batches and is killed (SIGKILL) at
// random moments, again and again; each restart resends everything from the start, as a phone's outbox
// would. At the end the store must hold each event exactly once and its hash chain must verify.
// Usage: npm run test:crash [-- rounds]   (uses a throwaway embedded Postgres in the OS temp folder)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uuidv7, type SeasonEvent } from "../src/lib/events";
import { EventStore } from "../src/lib/server/event-store";

const N = 1000;
const BATCH = 50;
const ROUNDS = Number(process.argv[2] ?? 12);

if (process.env.CRASH_WRITER) {
  // The writer: append every batch, resending from the start (duplicates are acknowledged, not stored).
  const { readFileSync } = await import("node:fs");
  const events = JSON.parse(readFileSync(process.env.CRASH_EVENTS!, "utf8")) as SeasonEvent[];
  const store = await EventStore.open({ dataDir: process.env.CRASH_WRITER });
  for (let i = 0; i < events.length; i += BATCH) {
    await store.append(events.slice(i, i + BATCH));
    process.stdout.write(`batch ${i / BATCH}\n`);
  }
  await store.close();
  process.stdout.write("done\n");
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "kk-crash-"));
const dataDir = join(dir, "pg");
const file = join(dir, "events.json");
const t0 = Date.now();
const events: SeasonEvent[] = Array.from({ length: N }, (_, i) => ({
  id: uuidv7(t0 + i),
  hlc: `${(t0 + i).toString(36).padStart(9, "0")}.0000.crash`,
  by: "crash",
  v: 1,
  label: "",
  kind: "entry",
  entry: { kind: "irrigate", plot: i % 192, day: i % 245, hour: 7, skipped: i % 2 === 0 },
}));
writeFileSync(file, JSON.stringify(events));

/** Run the writer; kill it a few milliseconds after it reports batch `killAt`, while it commits the next one. */
const run = (killAt: number | null) =>
  new Promise<"done" | "killed">((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/crash-test.mts"], {
      env: { ...process.env, CRASH_WRITER: dataDir, CRASH_EVENTS: file },
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    let armed = killAt !== null;
    child.stdout.on("data", (d) => {
      out += d;
      if (armed && out.includes(`batch ${killAt}\n`)) {
        armed = false;
        setTimeout(() => child.kill("SIGKILL"), Math.random() * 15);
      }
    });
    child.on("exit", () => resolve(out.includes("done") ? "done" : "killed"));
  });

const storedCount = async () => {
  const s = await EventStore.open({ dataDir });
  const { count } = await s.head();
  await s.close();
  return count;
};

// Each round kills the writer just past where the previous round got to, so every kill lands while
// new events are being committed, not while old ones are being acknowledged as duplicates.
let kills = 0;
let count = 0;
for (let r = 0; r < ROUNDS && count < N - BATCH; r++) {
  const killAt = Math.min(N / BATCH - 2, Math.floor(count / BATCH) + Math.floor(Math.random() * 2));
  if ((await run(killAt)) === "killed") kills++;
  const before = count;
  count = await storedCount();
  process.stdout.write(`round ${r + 1}: killed after batch ${killAt} · ${before} → ${count} stored\n`);
}
const final = await run(null);

const store = await EventStore.open({ dataDir });
const stored = (await store.since(0, N * 2)).events;
const ids = new Set(stored.map((e) => e.id));
const chain = await store.verifyChain();
await store.close();
rmSync(dir, { recursive: true, force: true });

const ok = kills > 0 && final === "done" && stored.length === N && ids.size === N && events.every((e) => ids.has(e.id)) && chain.ok;
console.log(`${ok ? "PASS" : "FAIL"}  ${kills} kills mid-write · ${stored.length} stored, ${ids.size} unique of ${N} · chain ${chain.ok ? "verifies" : `broken at ${"seq" in chain ? chain.seq : "?"}`}`);
process.exit(ok ? 0 : 1);
