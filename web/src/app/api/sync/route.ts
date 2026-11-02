import { connection } from "next/server";
import type { Escalation, SyncMsg } from "@/lib/channel";
import { MAX_BATCH } from "@/lib/events";
import { accept, relay, snapshot } from "@/lib/server/relay";

/**
 * Relay between devices (the farmer's phone and the officer's laptop) over server-sent events, backed
 * by the event store (season events) and the local SQLite database (inbox, messages): restarts lose nothing.
 */
const KINDS = new Set(["events", "time", "escalation", "reply", "reset", "receipt"]);

function valid(msg: unknown): msg is SyncMsg {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { kind?: unknown; from?: unknown };
  if (typeof m.from !== "string" || typeof m.kind !== "string" || !KINDS.has(m.kind)) return false;
  if (m.kind === "escalation") {
    const item = (msg as { item?: Escalation }).item;
    return Boolean(item && typeof item.id === "string" && typeof item.question === "string" && item.question.length <= 500);
  }
  // Each event is checked against the contract by the store, which answers per event.
  if (m.kind === "events") {
    const e = msg as { events?: unknown; label?: unknown };
    return Array.isArray(e.events) && e.events.length >= 1 && e.events.length <= MAX_BATCH && typeof e.label === "string" && e.label.length <= 200;
  }
  if (m.kind === "reply") {
    const r = msg as { id?: unknown; reply?: { text?: unknown } };
    return typeof r.id === "string" && typeof r.reply?.text === "string" && r.reply.text.length <= 1000;
  }
  return true;
}

export async function GET() {
  await connection();
  const r = relay();
  const encoder = new TextEncoder();
  let send: ((msg: SyncMsg) => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      send = (msg) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      r.subscribers.add(send);
      snapshot().then((m) => send?.(m)).catch(() => controller.error(new Error("event store unavailable")));
      ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);
    },
    cancel() {
      if (send) r.subscribers.delete(send);
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
  try {
    return Response.json({ ...(await accept(msg)), listeners: relay().subscribers.size });
  } catch (err) {
    // The store could not be reached: 503 keeps the message in the phone's outbox for a retry.
    return Response.json({ ok: false, error: String(err).slice(0, 200) }, { status: 503 });
  }
}
