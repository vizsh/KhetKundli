import { connection } from "next/server";
import type { Escalation, SyncMsg } from "@/lib/channel";
import { accept, relay, snapshot } from "@/lib/server/relay";

/**
 * Relay between devices (the farmer's phone and the officer's laptop) over server-sent events, backed
 * by the local SQLite database (src/lib/server/relay.ts): restarts keep the overrides, the inbox, the
 * messages and the event log.
 */
const KINDS = new Set(["overrides", "time", "escalation", "reply", "reset", "receipt"]);

const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;

/** A farmer's logged entry: a known kind, a plot, a season day and an hour, and sane amounts. */
function validEntry(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  if (typeof x.id !== "string" || x.id.length > 40 || !int(x.plot, 0, 999) || !int(x.day, 0, 400) || !int(x.hour, 0, 23)) return false;
  if (x.kind === "spray") return x.spray === "preventive" || x.spray === "curative";
  if (x.kind === "irrigate") return typeof x.skipped === "boolean" && (x.litres === undefined || int(x.litres, 0, 1_000_000));
  if (x.kind === "pick") return int(x.crates, 1, 1000) && (x.grade === "A" || x.grade === "B" || x.grade === "C");
  return false;
}

function valid(msg: unknown): msg is SyncMsg {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { kind?: unknown; from?: unknown };
  if (typeof m.from !== "string" || typeof m.kind !== "string" || !KINDS.has(m.kind)) return false;
  if (m.kind === "escalation") {
    const item = (msg as { item?: Escalation }).item;
    return Boolean(item && typeof item.id === "string" && typeof item.question === "string" && item.question.length <= 500);
  }
  if (m.kind === "overrides") {
    const entries = (msg as { overrides?: { entries?: unknown } }).overrides?.entries;
    if (entries === undefined) return true;
    return Array.isArray(entries) && entries.length <= 500 && entries.every(validEntry);
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
      send(snapshot());
      r.subscribers.add(send);
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
  return Response.json({ ...accept(msg), listeners: relay().subscribers.size });
}
