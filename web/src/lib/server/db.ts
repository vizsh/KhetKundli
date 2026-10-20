import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * The prototype's local database: one SQLite file beside the app (web/data/khetkundli.db), through
 * Node's built-in driver. It keeps what used to live only in memory, so a restart mid-demo loses
 * nothing: the relay's overrides and inbox, an append-only log of every synced event, the messages
 * the officer sends with their receipts, every agent answer, and weather snapshots for offline mode.
 */
const FILE = process.env.KHETKUNDLI_DB ?? resolve(process.cwd(), "data", "khetkundli.db");

const SCHEMA = `
create table if not exists kv (key text primary key, value text not null, updated_at text not null);
create table if not exists events (
  hlc text primary key, kind text not null, origin text not null, body text not null, received_at text not null);
create table if not exists messages (
  id text primary key, batch text not null, plot integer not null, plot_id text not null, farmer text not null,
  village text not null, channel text not null, kind text not null, day integer not null, text text not null, text_mr text not null,
  sent_at text not null, delivered_at text, read_at text, simulated integer not null default 0);
create index if not exists messages_batch on messages (batch);
create table if not exists agent_log (
  id integer primary key autoincrement, at text not null, question text not null, plot integer not null, day integer not null,
  audience text not null, intent text not null, confidence real not null, engine text not null, model text not null,
  guard_passed integer not null, ms integer not null, answer text not null, rating integer, correction text);
create table if not exists snapshots (name text primary key, fetched_at text not null, body text not null);
`;

const g = globalThis as unknown as { __khetkundliDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__khetkundliDb) {
    mkdirSync(dirname(FILE), { recursive: true });
    const d = new DatabaseSync(FILE);
    d.exec("pragma journal_mode = wal; pragma synchronous = normal;");
    d.exec(SCHEMA);
    g.__khetkundliDb = d;
  }
  return g.__khetkundliDb;
}

export const DB_FILE = FILE;
const now = () => new Date().toISOString();

export function getKv<T>(key: string, fallback: T): T {
  const row = db().prepare("select value from kv where key = ?").get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : fallback;
}

export function setKv(key: string, value: unknown) {
  db().prepare("insert into kv (key, value, updated_at) values (?, ?, ?) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at").run(key, JSON.stringify(value), now());
}

/** Append a synced event; returns false if its clock stamp was already recorded (a retry). */
export function appendEvent(hlc: string, kind: string, origin: string, body: unknown): boolean {
  const r = db().prepare("insert or ignore into events (hlc, kind, origin, body, received_at) values (?, ?, ?, ?, ?)").run(hlc, kind, origin, JSON.stringify(body), now());
  return Number(r.changes) > 0;
}

export function eventCount(): number {
  return Number((db().prepare("select count(*) as n from events").get() as { n: number }).n);
}

export function putSnapshot(name: string, body: unknown) {
  db().prepare("insert into snapshots (name, fetched_at, body) values (?, ?, ?) on conflict(name) do update set fetched_at = excluded.fetched_at, body = excluded.body").run(name, now(), JSON.stringify(body));
}

export function getSnapshot<T>(name: string): { fetchedAt: string; body: T } | null {
  const row = db().prepare("select fetched_at, body from snapshots where name = ?").get(name) as { fetched_at: string; body: string } | undefined;
  return row ? { fetchedAt: row.fetched_at, body: JSON.parse(row.body) as T } : null;
}

export function listSnapshots(): { name: string; fetchedAt: string; bytes: number }[] {
  return (db().prepare("select name, fetched_at, length(body) as bytes from snapshots order by name").all() as { name: string; fetched_at: string; bytes: number }[]).map((r) => ({ name: r.name, fetchedAt: r.fetched_at, bytes: Number(r.bytes) }));
}
