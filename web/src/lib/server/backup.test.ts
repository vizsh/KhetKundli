import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uuidv7, type SeasonEvent } from "@/lib/events";
import { restoreDrill, writeBackup } from "./backup";
import { EventStore } from "./event-store";
import { Identity } from "./identity";
import { MIGRATIONS } from "./schema";
import { migrate, openSql, type Sql } from "./sql";

/* A backup of a populated database restores into an empty one as the same record; a tampered one does not. */

let sql: Sql;
const root = mkdtempSync(join(tmpdir(), "kk-backup-"));
const T = Date.UTC(2026, 10, 3, 6);

before(async () => {
  sql = await openSql({ dataDir: "memory://" });
  await migrate(sql, MIGRATIONS);
  const id = new Identity(sql);
  const sunita = await id.upsertPerson({ phone: "9000000001", name: "Sunita Jadhav", nameMr: "सुनीता जाधव", role: "farmer", plots: [84] });
  const code = await id.requestOtp("9000000001", T);
  await id.verifyOtp("9000000001", code.ok ? code.code! : "", { label: "Phone", userAgent: "test" }, T);
  const events: SeasonEvent[] = Array.from({ length: 30 }, (_, i) => ({
    id: uuidv7(T + i), hlc: `${(T + i).toString(36).padStart(9, "0")}.0000.d1`, by: "d1", v: 1, label: "", kind: "entry",
    entry: { kind: "irrigate", plot: 84, day: 120 + i, hour: 7, skipped: i % 3 === 0 },
  }));
  await new EventStore(sql).append(events, T, { personId: sunita.id });
  await sql.query("insert into escalations (id, plot, person_id, item, asked_at) values ('Q1', 84, $1, $2, now())", [sunita.id, JSON.stringify({ id: "Q1", plot: 84, question: "Why?", context: [] })]);
  await sql.query("insert into advisory_batches (id, day, created_by, items) values ('B1', 150, 'officer', '[]')");
  await sql.query("insert into messages (id, batch, plot, item, sent_at) values ('B1-0', 'B1', 84, $1, now())", [JSON.stringify({ id: "B1-0", text: "Spray tomorrow" })]);
});
after(async () => {
  await sql.close();
  rmSync(root, { recursive: true, force: true });
});

test("backup → restore into an empty database → the same tables, chain and season", async () => {
  const { dir, manifest } = await writeBackup(sql, root);
  assert.equal(manifest.chain.count, 30);
  assert.equal(manifest.tables.people.rows, 1);
  assert.equal(manifest.tables.messages.rows, 1);
  const report = await restoreDrill(dir);
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter((c) => !c.ok)));
  assert.ok(report.checks.some((c) => c.name.startsWith("season record chain") && c.ok));
});

test("a backup file edited after the fact is refused", async () => {
  const { dir } = await writeBackup(sql, root);
  const file = join(dir, "messages.jsonl");
  writeFileSync(file, readFileSync(file, "utf8").replace("Spray tomorrow", "Spray today"));
  const report = await restoreDrill(dir);
  assert.equal(report.ok, false);
  assert.match(report.checks[0].detail, /messages\.jsonl does not match/);
});

test("a season event edited in the backup, with the manifest made to agree, still fails the chain", async () => {
  const { dir } = await writeBackup(sql, root);
  const file = join(dir, "season_events.jsonl");
  const forged = readFileSync(file, "utf8").replace('\\"skipped\\":true', '\\"skipped\\":false');
  writeFileSync(file, forged);
  const manifestPath = join(dir, "manifest.json");
  const m = JSON.parse(readFileSync(manifestPath, "utf8"));
  m.tables.season_events.sha256 = createHash("sha256").update(forged).digest("hex");
  writeFileSync(manifestPath, JSON.stringify(m));
  const report = await restoreDrill(dir);
  assert.equal(report.ok, false, "a forged event passed the drill");
});
