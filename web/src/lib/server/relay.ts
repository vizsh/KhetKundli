import type { Escalation, FarmMessage, SyncMsg } from "@/lib/channel";
import type { SeasonEvent } from "@/lib/events";
import { can, canRecord, plotOf, type Actor } from "./authz";
import { eventStore, type AppendResult } from "./event-store";
import { database } from "./pg";

/**
 * The relay between the phones and the desk, on Postgres. Every message is checked against the policy
 * (authz.ts) for the person who sent it; season events go to the append-only, hash-chained store; the
 * inbox (escalations), advisory batches and messages are tables; a durable message's clock stamp is
 * recorded so a retry is recognised. Each connected screen receives only what its person may see.
 */

/** A connected screen: who is signed in on it, or the one plot a public lot page is about. */
export type Subscriber = { send: (msg: SyncMsg) => void; actor: Actor; lotPlot?: number; heroPlot?: number };

type Relay = { t?: number; subscribers: Set<Subscriber> };
const g = globalThis as unknown as { __khetkundliRelay3?: Relay };

export function relay(): Relay {
  g.__khetkundliRelay3 ??= { subscribers: new Set() };
  return g.__khetkundliRelay3;
}

const STAFF = new Set(["officer", "fpo_admin"]);
const isStaff = (a: Actor) => Boolean(a && STAFF.has(a.person.role));
const ownsPlot = (a: Actor, plot: number | undefined) => plot !== undefined && Boolean(a?.person.plots.includes(plot));

/** The part of the season record a public lot page may see: its own plot's events and the shared ones. */
function lotEvents(events: SeasonEvent[], plot: number, heroPlot: number) {
  return events.filter((e) => {
    const p = plotOf(e);
    if (p !== null) return p === plot;
    return e.kind !== "harvest" || plot === heroPlot;
  });
}

/** What one screen may see of a message, or null. */
export function visible(sub: Subscriber, msg: SyncMsg): SyncMsg | null {
  if (sub.lotPlot !== undefined) {
    if (msg.kind !== "events") return null;
    const events = lotEvents(msg.events, sub.lotPlot, sub.heroPlot ?? -1);
    return events.length ? { ...msg, events } : null;
  }
  const a = sub.actor;
  if (!a || a.person.role === "buyer") return null;
  if (isStaff(a)) return msg;
  switch (msg.kind) {
    case "escalation": return ownsPlot(a, msg.item.plot) ? msg : null;
    case "reply":
    case "receipt": return ownsPlot(a, msg.plot) ? msg : null;
    case "message": return ownsPlot(a, msg.item.plot) ? msg : null;
    default: return msg;
  }
}

export function broadcast(msg: SyncMsg) {
  const r = relay();
  for (const s of r.subscribers) {
    const shown = visible(s, msg);
    if (!shown) continue;
    try {
      s.send(shown);
    } catch {
      r.subscribers.delete(s);
    }
  }
  return r.subscribers.size;
}

// ---------------- messages and advisory batches ----------------

type MessageRow = { item: FarmMessage; delivered_at: string | null; read_at: string | null; simulated: boolean };
const toMessage = (r: MessageRow): FarmMessage => ({
  ...r.item,
  deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : undefined,
  readAt: r.read_at ? new Date(r.read_at).toISOString() : undefined,
  simulated: Boolean(r.simulated),
});

/** Messages a person may see, newest first: every plot's for staff, her own plots' for a farmer. */
export async function messagesFor(a: Actor, limit = 300): Promise<FarmMessage[]> {
  if (!a) return [];
  const sql = await database();
  const rows = isStaff(a)
    ? await sql.query<MessageRow>("select item, delivered_at, read_at, simulated from messages order by sent_at desc limit $1", [limit])
    : await sql.query<MessageRow>("select item, delivered_at, read_at, simulated from messages where plot = any($1::int[]) order by sent_at desc limit $2", [a.person.plots, limit]);
  return rows.map(toMessage);
}

export type BatchItem = { plot: number; plotId: string; farmer: string; village: string; channel: "app" | "sms"; sms: string; smsMr: string };

/** Keep a prepared batch on the server; sending refers to it by id, so the text sent is the text prepared here. */
export async function saveBatch(day: number, createdBy: string, items: BatchItem[]): Promise<string> {
  const id = `B${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await (await database()).query("insert into advisory_batches (id, day, created_by, items) values ($1, $2, $3, $4)", [id, day, createdBy, JSON.stringify(items)]);
  return id;
}

/**
 * Send a stored batch once. `exclude` drops plots the officer unticked. A second send of the same
 * batch is refused, so a double click or a retry never sends twice.
 */
export async function sendBatch(batchId: string, exclude: number[], sentBy: string): Promise<{ ok: true; messages: FarmMessage[] } | { ok: false; reason: string; status: number }> {
  const sql = await database();
  return sql.tx(async (q) => {
    const rows = await q.query<{ day: number; items: BatchItem[] }>("update advisory_batches set sent_at = now(), sent_by = $2 where id = $1 and sent_at is null returning day, items", [batchId, sentBy]);
    if (!rows[0]) {
      const known = await q.query("select 1 from advisory_batches where id = $1", [batchId]);
      return known.length ? { ok: false as const, reason: "This batch was already sent.", status: 409 } : { ok: false as const, reason: "No batch with that id. Prepare it again.", status: 404 };
    }
    const skip = new Set(exclude);
    const sentAt = new Date().toISOString();
    const messages: FarmMessage[] = rows[0].items.filter((x) => !skip.has(x.plot)).map((x, i) => ({
      id: `${batchId}-${i}`, batch: batchId, plot: x.plot, plotId: x.plotId, farmer: x.farmer, village: x.village, channel: x.channel, kind: "advisory",
      day: Number(rows[0].day), text: x.sms.slice(0, 160), textMr: String(x.smsMr ?? "").slice(0, 160), sentAt,
    }));
    for (const m of messages) await q.query("insert into messages (id, batch, plot, item, sent_at) values ($1, $2, $3, $4, $5)", [m.id, batchId, m.plot, JSON.stringify(m), sentAt]);
    return { ok: true as const, messages };
  });
}

/** Record a receipt; returns the message's plot, or null if there is no such message. */
export async function saveReceipt(id: string, status: "delivered" | "read", at: string, simulated = false): Promise<number | null> {
  const sql = await database();
  const rows = status === "delivered"
    ? await sql.query<{ plot: number }>("update messages set delivered_at = coalesce(delivered_at, $2), simulated = simulated or $3 where id = $1 returning plot", [id, at, simulated])
    : await sql.query<{ plot: number }>("update messages set read_at = coalesce(read_at, $2), delivered_at = coalesce(delivered_at, $2) where id = $1 returning plot", [id, at]);
  return rows[0] ? Number(rows[0].plot) : null;
}

async function messagePlot(id: string): Promise<number | null> {
  const rows = await (await database()).query<{ plot: number }>("select plot from messages where id = $1", [id]);
  return rows[0] ? Number(rows[0].plot) : null;
}

// ---------------- the inbox ----------------

type EscalationRow = { item: Escalation; reply: Escalation["reply"] | null };
export async function inboxFor(a: Actor, limit = 200): Promise<Escalation[]> {
  if (!a) return [];
  const sql = await database();
  const rows = isStaff(a)
    ? await sql.query<EscalationRow>("select item, reply from escalations order by asked_at desc limit $1", [limit])
    : await sql.query<EscalationRow>("select item, reply from escalations where plot = any($1::int[]) order by asked_at desc limit $2", [a.person.plots, limit]);
  return rows.map((r) => ({ ...r.item, reply: r.reply ?? undefined }));
}

// ---------------- accepting messages ----------------

/**
 * Store season events for a person and pass on the ones that are new. Each event gets its own verdict
 * (accepted, duplicate, or rejected with the reason, including "not your plot").
 */
export async function acceptEvents(events: unknown[], from: string, label: string, actor: Actor, heroPlot: number): Promise<AppendResult[]> {
  const store = await eventStore();
  const results = await store.append(events, Date.now(), {
    personId: actor?.person.id ?? null,
    authorize: async (e, q) => {
      let targetAuthor: string | null | undefined;
      if (e.kind === "retract") {
        const t = await q.query<{ person_id: string | null }>("select person_id from season_events where id = $1", [e.target]);
        targetAuthor = t[0] ? t[0].person_id : undefined;
      }
      return canRecord(actor, e, { heroPlot, targetAuthor });
    },
  });
  const fresh = new Set(results.filter((x) => x.status === "accepted").map((x) => x.id));
  const accepted = (events as { id?: string }[]).filter((e) => typeof e?.id === "string" && fresh.has(e.id));
  if (accepted.length) broadcast({ kind: "events", from, events: accepted as SeasonEvent[], label });
  return results;
}

export type Accepted = { status: number; body: Record<string, unknown> };

/** Apply a message from a signed-in device: checked, recorded once, passed on to whoever may see it. */
export async function accept(msg: SyncMsg, actor: Actor, heroPlot: number): Promise<Accepted> {
  const r = relay();
  const refused = (reason: string): Accepted => ({ status: actor ? 403 : 401, body: { ok: false, error: reason } });

  if (msg.kind === "events") {
    const denied = can(actor, "read-season");
    if (denied) return refused(denied);
    return { status: 200, body: { ok: true, results: await acceptEvents(msg.events, msg.from, msg.label, actor, heroPlot) } };
  }
  if (msg.kind === "time") {
    const denied = can(actor, "time");
    if (denied) return refused(denied);
    r.t = msg.t;
    broadcast(msg);
    return { status: 200, body: { ok: true } };
  }

  // Durable messages: check first, then record the clock stamp so a retry is a no-op.
  let plot: number | undefined;
  let denied: string | null = null;
  if (msg.kind === "escalation") denied = can(actor, "escalate", (plot = msg.item.plot));
  else if (msg.kind === "reply") denied = can(actor, "reply");
  else if (msg.kind === "receipt") {
    const p = await messagePlot(msg.id);
    if (p === null) return { status: 404, body: { ok: false, error: "No message with that id." } };
    denied = can(actor, "receipt", (plot = p));
  } else if (msg.kind === "reset") denied = can(actor, "reset");
  else denied = "This kind of message is not accepted.";
  if (denied) return refused(denied);

  const sql = await database();
  if (msg.hlc) {
    const fresh = await sql.query("insert into sync_messages (hlc, kind, person_id) values ($1, $2, $3) on conflict (hlc) do nothing returning hlc", [msg.hlc, msg.kind, actor!.person.id]);
    if (!fresh.length) return { status: 200, body: { ok: true, duplicate: true } };
  }

  if (msg.kind === "escalation") {
    // The question is about the plot it names, from the person who sent it.
    const item: Escalation = { ...msg.item, question: msg.item.question.slice(0, 500), context: (msg.item.context ?? []).slice(0, 12).map((c) => String(c).slice(0, 200)) };
    const rows = await sql.query("insert into escalations (id, plot, person_id, item, asked_at) values ($1, $2, $3, $4, $5) on conflict (id) do nothing returning id", [item.id, item.plot, actor!.person.id, JSON.stringify(item), item.askedAt]);
    if (rows.length) broadcast({ ...msg, item });
  } else if (msg.kind === "reply") {
    const reply = { text: msg.reply.text.slice(0, 1000), by: actor!.person.name, at: new Date().toISOString() };
    const rows = await sql.query<{ plot: number }>("update escalations set reply = $2, replied_by = $3, replied_at = now() where id = $1 returning plot", [msg.id, JSON.stringify(reply), actor!.person.id]);
    if (!rows[0]) return { status: 404, body: { ok: false, error: "No question with that id." } };
    broadcast({ ...msg, reply, plot: Number(rows[0].plot) });
  } else if (msg.kind === "receipt") {
    await saveReceipt(msg.id, msg.status, msg.at, false);
    broadcast({ ...msg, simulated: false, plot });
  } else if (msg.kind === "reset") {
    // The season's reset is a `reset` event in the record; this clears the demo's inbox and messages.
    await sql.tx(async (q) => {
      await q.query("delete from messages");
      await q.query("delete from advisory_batches");
      await q.query("delete from escalations");
    });
    broadcast(msg);
  }
  return { status: 200, body: { ok: true } };
}

/** What a screen receives when it connects: the season record it may see, its inbox and messages, the clock. */
export async function snapshot(sub: Subscriber): Promise<SyncMsg> {
  const events = await (await eventStore()).current();
  if (sub.lotPlot !== undefined) return { kind: "state", from: "relay", events: lotEvents(events, sub.lotPlot, sub.heroPlot ?? -1), inbox: [] };
  const [inbox, messages] = await Promise.all([inboxFor(sub.actor), messagesFor(sub.actor)]);
  return { kind: "state", from: "relay", events, inbox, messages, t: relay().t };
}

/** The season as the server knows it: the overrides folded from its own events, never from a request. */
export async function serverOverrides() {
  const { foldEvents } = await import("@/lib/events");
  return foldEvents(await (await eventStore()).current());
}
