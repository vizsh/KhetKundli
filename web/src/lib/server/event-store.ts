import { createHash } from "node:crypto";
import { canonical, MAX_BATCH, SeasonEvent } from "@/lib/events";
import { database } from "./pg";
import { MIGRATIONS } from "./schema";
import { migrate, openSql, type Sql, type Tx } from "./sql";

/**
 * The season record on the server: an append-only, hash-chained table of season events.
 *
 * - Append-only: triggers refuse UPDATE, DELETE and TRUNCATE, so the application cannot rewrite history.
 *   An undo or a reset is a new event.
 * - Idempotent: an event id seen before is acknowledged as a duplicate, not stored twice.
 * - Tamper-evident: each row stores hash = sha256(prev_hash + "\n" + recorded_at + "\n" + doc), where
 *   doc is the event's canonical JSON; a row written by a signed-in person (since slice 2) also covers
 *   person_id, between recorded_at and doc. `verifyChain` walks the table and names the first row that does
 *   not hold, so an edit made directly in the database (bypassing the triggers) is caught.
 * - Validated: every event is checked against the contract in `@/lib/events` before it is stored.
 * - Authorised: the caller passes who is writing and a check per event (`src/lib/server/authz.ts`).
 */

export const GENESIS = "0".repeat(64);
const LOCK = 7_204_261; // advisory lock: appends are serialised so the chain has one head

export { MIGRATIONS } from "./schema";

export type AppendResult = { id: string; status: "accepted" | "duplicate" | "rejected"; seq?: number; reason?: string };
type Row = { seq: string | number; id: string; hlc: string; kind: string; actor: string; doc: string; recorded_at: string; prev_hash: string; hash: string; person_id: string | null };

export const chainHash = (prev: string, recordedAt: string, doc: string, personId?: string | null) =>
  createHash("sha256").update(personId ? `${prev}\n${recordedAt}\n${personId}\n${doc}` : `${prev}\n${recordedAt}\n${doc}`).digest("hex");

/** Who is appending, and the per-event check: null allows the event, a string refuses it with that reason. */
export type AppendContext = {
  personId?: string | null;
  authorize?: (e: SeasonEvent, q: Tx) => Promise<string | null> | string | null;
};

/** Clocks more than a day ahead of the server are refused: a device with a wrong date cannot jump the queue for ever. */
const MAX_AHEAD_MS = 24 * 3600 * 1000;
const hlcMs = (hlc: string) => parseInt(hlc.split(".")[0], 36);

export class EventStore {
  constructor(readonly sql: Sql) {}

  static async open(opts: Parameters<typeof openSql>[0] = {}) {
    const sql = await openSql(opts);
    await migrate(sql, MIGRATIONS);
    return new EventStore(sql);
  }

  /**
   * Append a batch. Each event gets its own verdict: accepted (stored, with its sequence number),
   * duplicate (this id is already stored with the same content), or rejected (with the reason). One
   * transaction for the batch, under an advisory lock, so the chain is never forked.
   */
  async append(input: unknown[], now = Date.now(), ctx: AppendContext = {}): Promise<AppendResult[]> {
    if (!Array.isArray(input) || input.length > MAX_BATCH) throw new Error(`a batch is 1 to ${MAX_BATCH} events`);
    return this.sql.tx(async (q) => {
      await q.query("select pg_advisory_xact_lock($1)", [LOCK]);
      let head = (await q.query<{ hash: string }>("select hash from season_events order by seq desc limit 1"))[0]?.hash ?? GENESIS;
      const out: AppendResult[] = [];
      for (const raw of input) {
        const parsed = SeasonEvent.safeParse(raw);
        const id = typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : "";
        if (!parsed.success) {
          out.push({ id, status: "rejected", reason: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "event"}: ${i.message}`).join("; ") });
          continue;
        }
        const e = parsed.data;
        if (hlcMs(e.hlc) > now + MAX_AHEAD_MS) {
          out.push({ id: e.id, status: "rejected", reason: "clock stamp is more than a day ahead of the server" });
          continue;
        }
        const refused = ctx.authorize ? await ctx.authorize(e, q) : null;
        if (refused) {
          out.push({ id: e.id, status: "rejected", reason: refused });
          continue;
        }
        const doc = canonical(e);
        const existing = (await q.query<{ seq: string; doc: string }>("select seq, doc from season_events where id = $1", [e.id]))[0];
        if (existing) {
          out.push(existing.doc === doc
            ? { id: e.id, status: "duplicate", seq: Number(existing.seq) }
            : { id: e.id, status: "rejected", reason: "this id is already stored with different content" });
          continue;
        }
        const recordedAt = new Date(now).toISOString();
        const personId = ctx.personId ?? null;
        const hash = chainHash(head, recordedAt, doc, personId);
        const row = (await q.query<{ seq: string }>(
          "insert into season_events (id, hlc, kind, actor, doc, recorded_at, prev_hash, hash, person_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning seq",
          [e.id, e.hlc, e.kind, e.by, doc, recordedAt, head, hash, personId],
        ))[0];
        head = hash;
        out.push({ id: e.id, status: "accepted", seq: Number(row.seq) });
      }
      return out;
    });
  }

  /** Events in arrival order after a cursor (a sequence number), with the cursor to ask from next. */
  async since(after = 0, limit = 5000): Promise<{ events: SeasonEvent[]; cursor: number }> {
    const rows = await this.sql.query<Row>("select seq, doc from season_events where seq > $1 order by seq limit $2", [after, limit]);
    return { events: rows.map((r) => JSON.parse(r.doc) as SeasonEvent), cursor: rows.length ? Number(rows.at(-1)!.seq) : after };
  }

  /** Every event since the last reset: what a screen needs to rebuild the season. */
  async current(): Promise<SeasonEvent[]> {
    const rows = await this.sql.query<Row>(
      `select doc from season_events
        where seq > coalesce((select max(seq) from season_events where kind = 'reset'), 0) - 1
        order by seq`,
    );
    return rows.map((r) => JSON.parse(r.doc) as SeasonEvent);
  }

  async head(): Promise<{ count: number; hash: string }> {
    const r = (await this.sql.query<{ n: string; hash: string | null }>("select count(*) as n, (select hash from season_events order by seq desc limit 1) as hash from season_events"))[0];
    return { count: Number(r.n), hash: r.hash ?? GENESIS };
  }

  /**
   * Walk the chain from the first row. Each row must point at the previous row's hash, its hash must
   * recompute from its own contents, and its indexed columns must agree with its document.
   */
  async verifyChain(): Promise<{ ok: true; count: number; head: string } | { ok: false; count: number; seq: number; reason: string }> {
    let prev = GENESIS;
    let count = 0;
    let after = 0;
    for (;;) {
      const rows = await this.sql.query<Row>("select * from season_events where seq > $1 order by seq limit 2000", [after]);
      if (!rows.length) return { ok: true, count, head: prev };
      for (const r of rows) {
        const seq = Number(r.seq);
        if (r.prev_hash !== prev) return { ok: false, count, seq, reason: "does not follow the previous row (a row was removed, inserted or reordered)" };
        if (chainHash(r.prev_hash, r.recorded_at, r.doc, r.person_id) !== r.hash) return { ok: false, count, seq, reason: "its contents no longer match its hash (the row was edited)" };
        let doc: { id?: string; hlc?: string; kind?: string; by?: string };
        try { doc = JSON.parse(r.doc); } catch { return { ok: false, count, seq, reason: "its document is not valid JSON" }; }
        if (doc.id !== r.id || doc.hlc !== r.hlc || doc.kind !== r.kind || doc.by !== r.actor) return { ok: false, count, seq, reason: "its columns disagree with its document" };
        prev = r.hash;
        count += 1;
        after = seq;
      }
    }
  }

  close() { return this.sql.close(); }
}

/** The process's store, on the shared database handle. */
export async function eventStore(): Promise<EventStore> {
  return new EventStore(await database());
}
