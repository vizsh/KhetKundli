import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { canonical, foldEvents } from "@/lib/events";
import { EventStore } from "./event-store";
import { MIGRATIONS } from "./schema";
import { migrate, openSql, type Sql } from "./sql";

/**
 * Backups that prove themselves. A backup is one JSON-lines file per table and a manifest with each
 * file's row count and sha256, the season record's chain head, and the schema version. It is logical
 * (plain rows), so it restores into embedded Postgres or a Postgres server alike.
 *
 * The restore drill loads a backup into an empty throwaway database and checks that every table hashes
 * the same as at backup time, that the season record's hash chain verifies with the same head, and that
 * the season the record folds into is the same. One-time codes and the code key are not backed up.
 */

/** Tables in the order they restore (parents before children). */
export const TABLES = ["people", "person_plots", "devices", "sessions", "auth_log", "season_events", "escalations", "advisory_batches", "messages", "sync_messages"] as const;
const ORDER_BY: Record<(typeof TABLES)[number], string> = {
  people: "id", person_plots: "person_id, plot", devices: "id", sessions: "token_hash", auth_log: "id",
  season_events: "seq", escalations: "id", advisory_batches: "id", messages: "id", sync_messages: "hlc",
};
const SERIAL: Partial<Record<(typeof TABLES)[number], string>> = { season_events: "seq", auth_log: "id" };

export type Manifest = {
  createdAt: string;
  schemaVersion: number;
  database: string;
  tables: Record<string, { rows: number; sha256: string }>;
  chain: { count: number; head: string };
  season: string;
};

/** A row as plain JSON: dates as ISO strings, big integers as numbers, json columns as values. */
function plain(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : typeof v === "bigint" ? Number(v) : v;
  return out;
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const lines = (rows: Record<string, unknown>[]) => rows.map((r) => canonical(r)).join("\n");

async function seasonHash(sql: Sql) {
  return sha(canonical(foldEvents(await new EventStore(sql).current())));
}

export async function exportAll(sql: Sql): Promise<{ manifest: Manifest; data: Record<string, Record<string, unknown>[]> }> {
  const data: Record<string, Record<string, unknown>[]> = {};
  const tables: Manifest["tables"] = {};
  for (const t of TABLES) {
    const rows = (await sql.query<Record<string, unknown>>(`select * from ${t} order by ${ORDER_BY[t]}`)).map(plain);
    data[t] = rows;
    tables[t] = { rows: rows.length, sha256: sha(lines(rows)) };
  }
  const chain = await new EventStore(sql).verifyChain();
  if (!chain.ok) throw new Error(`refusing to back up a broken record: row ${chain.seq} ${chain.reason}`);
  return {
    manifest: { createdAt: new Date().toISOString(), schemaVersion: MIGRATIONS.length, database: sql.kind, tables, chain: { count: chain.count, head: chain.head }, season: await seasonHash(sql) },
    data,
  };
}

export const BACKUP_ROOT = () => resolve(process.cwd(), "data", "backups");

/** Write a backup of the live database into `root/<timestamp>/`; returns the folder and the manifest. */
export async function writeBackup(sql: Sql, root = BACKUP_ROOT()) {
  const { manifest, data } = await exportAll(sql);
  const dir = join(root, manifest.createdAt.replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  for (const t of TABLES) writeFileSync(join(dir, `${t}.jsonl`), lines(data[t]));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { dir, manifest };
}

export function latestBackup(root = BACKUP_ROOT()): string | null {
  try {
    const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    return dirs.length ? join(root, dirs.at(-1)!) : null;
  } catch {
    return null;
  }
}

function readBackup(dir: string) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
  const data: Record<string, Record<string, unknown>[]> = {};
  const problems: string[] = [];
  for (const t of TABLES) {
    const text = readFileSync(join(dir, `${t}.jsonl`), "utf8");
    if (sha(text) !== manifest.tables[t]?.sha256) problems.push(`${t}.jsonl does not match its hash in the manifest`);
    data[t] = text ? text.split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) : [];
  }
  return { manifest, data, problems };
}

/** Load a backup into a migrated, empty database. */
export async function restoreInto(sql: Sql, dir: string) {
  const { manifest, data, problems } = readBackup(dir);
  if (problems.length) throw new Error(problems.join("; "));
  if (manifest.schemaVersion > MIGRATIONS.length) throw new Error(`backup is from a newer schema (${manifest.schemaVersion})`);
  await sql.tx(async (q) => {
    for (const t of TABLES) {
      for (const row of data[t]) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => (row[c] !== null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));
        await q.query(`insert into ${t} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, vals);
      }
      const serial = SERIAL[t];
      if (serial && data[t].length) await q.query(`select setval(pg_get_serial_sequence('${t}', '${serial}'), (select max(${serial}) from ${t}))`);
    }
  });
  return manifest;
}

export type DrillReport = { ok: boolean; dir: string; checks: { name: string; ok: boolean; detail: string }[] };

/** Restore a backup into a throwaway database and prove it is the same record. */
export async function restoreDrill(dir: string): Promise<DrillReport> {
  const checks: DrillReport["checks"] = [];
  const sql = await openSql({ dataDir: "memory://" });
  try {
    await migrate(sql, MIGRATIONS);
    let manifest: Manifest;
    try {
      manifest = await restoreInto(sql, dir);
      checks.push({ name: "files match the manifest and restore", ok: true, detail: `${Object.values(manifest.tables).reduce((n, t) => n + t.rows, 0)} rows` });
    } catch (err) {
      checks.push({ name: "files match the manifest and restore", ok: false, detail: String(err).slice(0, 300) });
      return { ok: false, dir, checks };
    }
    const again = await exportAll(sql);
    for (const t of TABLES) {
      const same = again.manifest.tables[t].sha256 === manifest.tables[t].sha256;
      checks.push({ name: `table ${t}`, ok: same, detail: `${again.manifest.tables[t].rows} rows${same ? "" : " · differs after restore"}` });
    }
    const chainSame = again.manifest.chain.head === manifest.chain.head && again.manifest.chain.count === manifest.chain.count;
    checks.push({ name: "season record chain verifies, same head", ok: chainSame, detail: `${again.manifest.chain.count} events · head ${again.manifest.chain.head.slice(0, 16)}` });
    checks.push({ name: "the season folds the same", ok: again.manifest.season === manifest.season, detail: again.manifest.season.slice(0, 16) });
    return { ok: checks.every((c) => c.ok), dir, checks };
  } catch (err) {
    checks.push({ name: "drill completed", ok: false, detail: String(err).slice(0, 300) });
    return { ok: false, dir, checks };
  } finally {
    await sql.close();
  }
}
