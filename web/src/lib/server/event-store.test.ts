import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { uuidv7, type SeasonEvent } from "@/lib/events";
import { EventStore } from "./event-store";

/*
 * The store against a real (embedded) Postgres: idempotent appends, refused rewrites, and a hash
 * chain that names the first row anyone tampered with.
 */

const NOW = Date.UTC(2026, 10, 3, 6);
let n = 0;
const hlc = (dev = "dev1") => `${(NOW + n).toString(36).padStart(9, "0")}.${(n++ % 1000).toString(36).padStart(4, "0")}.${dev}`;
const spray = (plot = 84, day = 155): SeasonEvent => ({ id: uuidv7(NOW + n), hlc: hlc(), by: "dev1", v: 1, label: "spray", kind: "entry", entry: { kind: "spray", plot, day, hour: 7, spray: "curative" } });
const fresh = () => EventStore.open({ dataDir: "memory://" });

let store: EventStore;
before(async () => { store = await fresh(); });
after(() => store.close());

test("accepts valid events once; a retry is a duplicate", async () => {
  const batch = [spray(1), spray(2), spray(3)];
  const first = await store.append(batch, NOW);
  assert.deepEqual(first.map((r) => r.status), ["accepted", "accepted", "accepted"]);
  const again = await store.append(batch, NOW);
  assert.deepEqual(again.map((r) => r.status), ["duplicate", "duplicate", "duplicate"]);
  assert.deepEqual(again.map((r) => r.seq), first.map((r) => r.seq));
  assert.equal((await store.head()).count, 3);
});

test("rejects malformed events, reused ids and clocks a day ahead, each with a reason", async () => {
  const ok = spray(4);
  await store.append([ok], NOW);
  const res = await store.append([
    { ...ok, entry: { ...ok.kind === "entry" ? ok.entry : {}, plot: 5 } },
    { ...spray(), entry: { kind: "spray", plot: 1, day: 999, hour: 7, spray: "curative" } },
    { kind: "nonsense" },
    { ...spray(), hlc: `${(NOW + 3 * 24 * 3600e3).toString(36).padStart(9, "0")}.0000.dev1` },
  ], NOW);
  assert.deepEqual(res.map((r) => r.status), ["rejected", "rejected", "rejected", "rejected"]);
  assert.match(res[0].reason!, /different content/);
  assert.match(res[1].reason!, /entry\.day/);
  assert.match(res[3].reason!, /day ahead/);
});

test("the table is append-only: update, delete and truncate are refused", async () => {
  await store.append([spray()], NOW);
  await assert.rejects(store.sql.query("update season_events set doc = '{}'"), /append-only: UPDATE/);
  await assert.rejects(store.sql.query("delete from season_events"), /append-only: DELETE/);
  await assert.rejects(store.sql.query("truncate season_events"), /append-only: TRUNCATE/);
  assert.equal((await store.verifyChain()).ok, true);
});

test("the chain names the first tampered row: an edit, a removal, a forged insert", async () => {
  for (const attack of ["edit", "remove", "forge"] as const) {
    const s = await fresh();
    await s.append(Array.from({ length: 6 }, (_, i) => spray(i)), NOW);
    assert.deepEqual(await s.verifyChain().then((v) => v.ok), true);
    // Someone with database access turns the guard off.
    await s.sql.query("alter table season_events disable trigger user");
    if (attack === "edit") await s.sql.query("update season_events set doc = replace(doc, '\"curative\"', '\"preventive\"') where seq = 4");
    if (attack === "remove") await s.sql.query("delete from season_events where seq = 3");
    if (attack === "forge") {
      const e = spray(9);
      await s.sql.query("insert into season_events (id, hlc, kind, actor, doc, recorded_at, prev_hash, hash) values ($1, $2, 'entry', 'dev1', $3, $4, $5, $6)", [e.id, e.hlc, JSON.stringify(e), new Date(NOW).toISOString(), "f".repeat(64), "e".repeat(64)]);
    }
    const v = await s.verifyChain();
    assert.equal(v.ok, false, attack);
    if (!v.ok) assert.equal(v.seq, attack === "edit" ? 4 : attack === "remove" ? 4 : 7, `${attack}: ${v.reason}`);
    await s.close();
  }
});

test("convergence at the store: batches from many devices, in any order, with retries, store the union once", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 25 }), fc.array(fc.nat(), { minLength: 1, maxLength: 60 }), async (size, picks) => {
      const s = await fresh();
      const events = Array.from({ length: size }, (_, i) => spray(i % 6, 140 + (i % 10)));
      const sends = picks.map((p) => events[p % size]);
      for (let i = 0; i < sends.length; i += 1 + (picks[i] % 5)) await s.append(sends.slice(i, i + 1 + (picks[i] % 5)), NOW);
      await s.append(events, NOW); // every device eventually sends everything it has
      const stored = (await s.since(0)).events.map((e) => e.id).sort();
      assert.deepEqual(stored, events.map((e) => e.id).sort());
      assert.equal((await s.verifyChain()).ok, true);
      await s.close();
    }),
    { numRuns: 60 },
  );
});

test("a reset hides earlier events from current() but keeps them in the record", async () => {
  const s = await fresh();
  await s.append([spray(1), spray(2)], NOW);
  const reset: SeasonEvent = { id: uuidv7(NOW + 99), hlc: hlc(), by: "desk", v: 1, label: "reset", kind: "reset" };
  await s.append([reset, spray(3)], NOW);
  const current = await s.current();
  assert.deepEqual(current.map((e) => e.kind), ["reset", "entry"]);
  assert.equal((await s.head()).count, 4);
  await s.close();
});
