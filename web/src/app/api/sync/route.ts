import { connection } from "next/server";
import type { Escalation, SyncMsg } from "@/lib/channel";
import { MAX_BATCH } from "@/lib/events";
import { parseLotId } from "@/lib/lot";
import { actorOf, limited, refuse, tooMany } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { accept, relay, snapshot, type Subscriber } from "@/lib/server/relay";
import { heroPlot } from "@/lib/server/seed";
import { generateSeason } from "@/lib/sim/season";

/**
 * Relay between devices over server-sent events. A signed-in screen receives what its person may see;
 * a public lot page (`?lot=TAR-214-P1`) receives only that plot's record. Every message posted is
 * checked against the policy for the person who sent it (src/lib/server/authz.ts).
 */
const KINDS = new Set(["events", "time", "escalation", "reply", "reset", "receipt"]);

function valid(msg: unknown): msg is SyncMsg {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as { kind?: unknown; from?: unknown; hlc?: unknown };
  if (typeof m.from !== "string" || m.from.length > 40 || typeof m.kind !== "string" || !KINDS.has(m.kind)) return false;
  if (m.hlc !== undefined && (typeof m.hlc !== "string" || m.hlc.length > 80)) return false;
  if (m.kind === "escalation") {
    const item = (msg as { item?: Escalation }).item;
    return Boolean(item && typeof item.id === "string" && item.id.length <= 64 && typeof item.question === "string" && item.question.length <= 500
      && Number.isInteger(item.plot) && typeof item.askedAt === "string" && !Number.isNaN(Date.parse(item.askedAt)));
  }
  // Each event is checked against the contract and the policy by the store, which answers per event.
  if (m.kind === "events") {
    const e = msg as { events?: unknown; label?: unknown };
    return Array.isArray(e.events) && e.events.length >= 1 && e.events.length <= MAX_BATCH && typeof e.label === "string" && e.label.length <= 200;
  }
  if (m.kind === "reply") {
    const r = msg as { id?: unknown; reply?: { text?: unknown } };
    return typeof r.id === "string" && typeof r.reply?.text === "string" && r.reply.text.length <= 1000;
  }
  if (m.kind === "receipt") {
    const r = msg as { id?: unknown; status?: unknown; at?: unknown };
    return typeof r.id === "string" && (r.status === "delivered" || r.status === "read") && typeof r.at === "string";
  }
  if (m.kind === "time") return typeof (msg as { t?: unknown }).t === "number";
  return true;
}

/** The plot a public lot page is about, from its lot number, or null if there is no such plot. */
function lotPlot(lot: string): number | null {
  const parsed = parseLotId(lot);
  if (!parsed) return null;
  const i = generateSeason().plots.findIndex((p) => p.id === parsed.plotId);
  return i >= 0 ? i : null;
}

export async function GET(req: Request) {
  await connection();
  const lot = new URL(req.url).searchParams.get("lot");
  const actor = await actorOf(req);
  let sub: Omit<Subscriber, "send">;
  if (lot) {
    const plot = lotPlot(lot);
    if (plot === null) return Response.json({ error: "No such lot." }, { status: 404 });
    sub = { actor: null, lotPlot: plot, heroPlot: heroPlot() };
  } else {
    const denied = can(actor, "read-season");
    if (denied) return refuse(denied);
    sub = { actor };
  }

  const r = relay();
  const encoder = new TextEncoder();
  let subscriber: Subscriber | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      subscriber = { ...sub, send: (msg) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)) };
      r.subscribers.add(subscriber);
      snapshot(subscriber).then((m) => subscriber?.send(m)).catch(() => controller.error(new Error("the record is unavailable")));
      ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);
    },
    cancel() {
      if (subscriber) r.subscribers.delete(subscriber);
      if (ping) clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

export async function POST(request: Request) {
  const actor = await actorOf(request);
  if (!actor) return refuse("Sign in first.");
  const msg: unknown = await request.json().catch(() => null);
  if (!valid(msg)) return Response.json({ ok: false, error: "unrecognised message" }, { status: 400 });
  // The clock moves often and is not stored; everything else is limited per person.
  if (msg.kind !== "time") {
    const wait = limited(`sync:${actor.person.id}`, 240, 60_000);
    if (wait) return tooMany(wait);
  }
  try {
    const { status, body } = await accept(msg, actor, heroPlot());
    return Response.json({ ...body, listeners: relay().subscribers.size }, { status });
  } catch (err) {
    // The record could not be reached: 503 keeps the message in the phone's outbox for a retry.
    return Response.json({ ok: false, error: String(err).slice(0, 200) }, { status: 503 });
  }
}
