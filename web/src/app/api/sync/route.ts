import { connection } from "next/server";
import type { Escalation, SyncMsg } from "@/lib/channel";
import type { Overrides } from "@/lib/sim/types";

/**
 * Demo relay between devices (a farmer's phone and the officer's laptop) over server-sent events.
 * State lives in this server process: it suits a laptop running `next dev` / `next start` on the
 * venue Wi-Fi, not a multi-instance serverless deployment.
 */
type Relay = { overrides: Overrides; inbox: Escalation[]; t?: number; subscribers: Set<(msg: SyncMsg) => void> };
const g = globalThis as unknown as { __khetkundliRelay?: Relay };
const relay: Relay = (g.__khetkundliRelay ??= { overrides: {}, inbox: [], subscribers: new Set() });

const KINDS = new Set(["overrides", "time", "escalation", "reply", "reset"]);
const MAX_INBOX = 200;

function valid(msg: unknown): msg is SyncMsg {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { kind?: unknown; from?: unknown };
  if (typeof m.from !== "string" || typeof m.kind !== "string" || !KINDS.has(m.kind)) return false;
  if (m.kind === "escalation") {
    const item = (msg as { item?: Escalation }).item;
    return Boolean(item && typeof item.id === "string" && typeof item.question === "string" && item.question.length <= 500);
  }
  if (m.kind === "reply") {
    const r = msg as { id?: unknown; reply?: { text?: unknown } };
    return typeof r.id === "string" && typeof r.reply?.text === "string" && r.reply.text.length <= 1000;
  }
  return true;
}

export async function GET() {
  await connection();
  const encoder = new TextEncoder();
  let send: ((msg: SyncMsg) => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      send = (msg) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      send({ kind: "state", from: "relay", overrides: relay.overrides, inbox: relay.inbox, t: relay.t });
      relay.subscribers.add(send);
      ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);
    },
    cancel() {
      if (send) relay.subscribers.delete(send);
      if (ping) clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

export async function POST(request: Request) {
  const msg: unknown = await request.json().catch(() => null);
  if (!valid(msg)) return Response.json({ ok: false, error: "unrecognised message" }, { status: 400 });
  if (msg.kind === "overrides") relay.overrides = msg.overrides;
  if (msg.kind === "time") relay.t = msg.t;
  if (msg.kind === "escalation" && !relay.inbox.some((q) => q.id === msg.item.id)) relay.inbox = [msg.item, ...relay.inbox].slice(0, MAX_INBOX);
  if (msg.kind === "reply") relay.inbox = relay.inbox.map((q) => (q.id === msg.id ? { ...q, reply: msg.reply } : q));
  if (msg.kind === "reset") {
    relay.overrides = {};
    relay.inbox = [];
  }
  for (const s of relay.subscribers) {
    try {
      s(msg);
    } catch {
      relay.subscribers.delete(s);
    }
  }
  return Response.json({ ok: true, listeners: relay.subscribers.size });
}
