import type { Escalation, FarmMessage, SyncMsg } from "@/lib/channel";
import type { AppendResult } from "./event-store";
import { eventStore } from "./event-store";
import { appendEvent, db, getKv, setKv } from "./db";

/**
 * The relay between the phones and the desk. Season events go to the append-only, hash-chained
 * event store (Postgres), which decides what is new; only accepted events are passed on. The inbox,
 * messages and receipts still live in the local SQLite database (they move to Postgres in a later
 * step of Phase 1). Live delivery is over server-sent events to every connected screen.
 */
type Relay = {
  inbox: Escalation[];
  t?: number;
  subscribers: Set<(msg: SyncMsg) => void>;
};

const MAX_INBOX = 200;
const g = globalThis as unknown as { __khetkundliRelay2?: Relay };

export function relay(): Relay {
  if (!g.__khetkundliRelay2) {
    g.__khetkundliRelay2 = {
      inbox: getKv<Escalation[]>("inbox", []),
      subscribers: new Set(),
    };
  }
  return g.__khetkundliRelay2;
}

export function broadcast(msg: SyncMsg) {
  const r = relay();
  for (const s of r.subscribers) {
    try {
      s(msg);
    } catch {
      r.subscribers.delete(s);
    }
  }
  return r.subscribers.size;
}

type Row = { id: string; batch: string; plot: number; plot_id: string; farmer: string; village: string; channel: string; kind: string; day: number; text: string; text_mr: string; sent_at: string; delivered_at: string | null; read_at: string | null; simulated: number };
const toMessage = (r: Row): FarmMessage => ({
  id: r.id, batch: r.batch, plot: Number(r.plot), plotId: r.plot_id, farmer: r.farmer, village: r.village, channel: r.channel as FarmMessage["channel"], kind: "advisory",
  day: Number(r.day), text: r.text, textMr: r.text_mr, sentAt: r.sent_at, deliveredAt: r.delivered_at ?? undefined, readAt: r.read_at ?? undefined, simulated: Boolean(r.simulated),
});

export function recentMessages(limit = 300): FarmMessage[] {
  return (db().prepare("select * from messages order by sent_at desc limit ?").all(limit) as unknown as Row[]).map(toMessage);
}

export function saveMessage(m: FarmMessage) {
  db().prepare(`insert or ignore into messages (id, batch, plot, plot_id, farmer, village, channel, kind, day, text, text_mr, sent_at, delivered_at, read_at, simulated)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(m.id, m.batch, m.plot, m.plotId, m.farmer, m.village, m.channel, m.kind, m.day, m.text, m.textMr, m.sentAt, m.deliveredAt ?? null, m.readAt ?? null, m.simulated ? 1 : 0);
}

export function saveReceipt(id: string, status: "delivered" | "read", at: string, simulated = false) {
  if (status === "delivered") db().prepare("update messages set delivered_at = coalesce(delivered_at, ?), simulated = max(simulated, ?) where id = ?").run(at, simulated ? 1 : 0, id);
  else db().prepare("update messages set read_at = coalesce(read_at, ?), delivered_at = coalesce(delivered_at, ?) where id = ?").run(at, at, id);
}

/**
 * Store season events and pass on the ones that are new. Each event gets its own verdict, so a phone
 * can drop what was accepted or is a duplicate from its outbox and keep only what was rejected.
 */
export async function acceptEvents(events: unknown[], from: string, label: string): Promise<AppendResult[]> {
  const store = await eventStore();
  const results = await store.append(events);
  const fresh = new Set(results.filter((x) => x.status === "accepted").map((x) => x.id));
  const accepted = (events as { id?: string }[]).filter((e) => typeof e?.id === "string" && fresh.has(e.id));
  if (accepted.length) broadcast({ kind: "events", from, events: accepted as never, label });
  return results;
}

/** Apply a message from a device; returns how it was handled. */
export async function accept(msg: SyncMsg): Promise<{ ok: true; duplicate?: boolean; results?: AppendResult[] }> {
  const r = relay();
  if (msg.kind === "events") return { ok: true, results: await acceptEvents(msg.events, msg.from, msg.label) };
  if (msg.hlc && msg.kind !== "time" && !appendEvent(msg.hlc, msg.kind, msg.from, msg)) return { ok: true, duplicate: true };
  if (msg.kind === "time") r.t = msg.t;
  if (msg.kind === "escalation" && !r.inbox.some((q) => q.id === msg.item.id)) {
    r.inbox = [msg.item, ...r.inbox].slice(0, MAX_INBOX);
    setKv("inbox", r.inbox);
  }
  if (msg.kind === "reply") {
    r.inbox = r.inbox.map((q) => (q.id === msg.id ? { ...q, reply: msg.reply } : q));
    setKv("inbox", r.inbox);
  }
  if (msg.kind === "receipt") saveReceipt(msg.id, msg.status, msg.at, msg.simulated);
  // The season's reset is a `reset` event in the store; this message clears the inbox and messages.
  if (msg.kind === "reset") {
    r.inbox = [];
    setKv("inbox", []);
    db().exec("delete from messages");
  }
  broadcast(msg);
  return { ok: true };
}

export async function snapshot(): Promise<SyncMsg> {
  const r = relay();
  const events = await (await eventStore()).current();
  return { kind: "state", from: "relay", events, inbox: r.inbox, messages: recentMessages(), t: r.t };
}

/** The season as the server knows it: the overrides folded from its own events, never from a request. */
export async function serverOverrides() {
  const { foldEvents } = await import("@/lib/events");
  return foldEvents(await (await eventStore()).current());
}
