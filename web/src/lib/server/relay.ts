import type { Escalation, FarmMessage, SyncMsg } from "@/lib/channel";
import type { Overrides } from "@/lib/sim/types";
import { appendEvent, db, getKv, setKv } from "./db";

/**
 * The relay between the phones and the desk, backed by the local database. Every durable message is
 * appended to the event log by its clock stamp (a retry is recognised and dropped); the current
 * overrides, the inbox and the messages are kept so a restarted server picks up where it was.
 * Live delivery is over server-sent events to every connected screen.
 */
type Relay = {
  overrides: Overrides;
  overridesHlc: string;
  inbox: Escalation[];
  t?: number;
  subscribers: Set<(msg: SyncMsg) => void>;
};

const MAX_INBOX = 200;
const g = globalThis as unknown as { __khetkundliRelay2?: Relay };

export function relay(): Relay {
  if (!g.__khetkundliRelay2) {
    g.__khetkundliRelay2 = {
      overrides: getKv<Overrides>("overrides", {}),
      overridesHlc: getKv<string>("overridesHlc", ""),
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

/** Apply a message from a device; returns how it was handled. */
export function accept(msg: SyncMsg): { ok: true; duplicate?: boolean; stale?: boolean } {
  const r = relay();
  if (msg.hlc && msg.kind !== "time" && !appendEvent(msg.hlc, msg.kind, msg.from, msg)) return { ok: true, duplicate: true };
  if (msg.kind === "overrides" && msg.hlc && msg.hlc <= r.overridesHlc) return { ok: true, stale: true };
  if (msg.kind === "overrides") {
    r.overrides = msg.overrides;
    r.overridesHlc = msg.hlc ?? r.overridesHlc;
    setKv("overrides", r.overrides);
    setKv("overridesHlc", r.overridesHlc);
  }
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
  if (msg.kind === "reset") {
    r.overrides = {};
    r.inbox = [];
    r.overridesHlc = msg.hlc ?? "";
    setKv("overrides", {});
    setKv("overridesHlc", r.overridesHlc);
    setKv("inbox", []);
    db().exec("delete from messages");
  }
  broadcast(msg);
  return { ok: true };
}

export function snapshot(): SyncMsg {
  const r = relay();
  return { kind: "state", from: "relay", overrides: r.overrides, inbox: r.inbox, messages: recentMessages(), t: r.t, hlc: r.overridesHlc || undefined };
}
