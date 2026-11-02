import { connection } from "next/server";
import { MAX_BATCH } from "@/lib/events";
import { eventStore } from "@/lib/server/event-store";
import { acceptEvents } from "@/lib/server/relay";

/**
 * The season record, version 1.
 *
 * GET  /api/v1/events?after=<seq>&limit=<n>  events in arrival order after a cursor, and the next cursor
 * POST /api/v1/events  { from, label, events: [...] }  one verdict per event: accepted (with its
 *      sequence number), duplicate (already stored; safe to drop from an outbox) or rejected (with the reason)
 */
export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const after = Math.max(0, Math.floor(Number(url.searchParams.get("after") ?? 0)) || 0);
  const limit = Math.min(5000, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 1000)) || 1000));
  const store = await eventStore();
  return Response.json(await store.since(after, limit));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { from?: unknown; label?: unknown; events?: unknown } | null;
  if (!body || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > MAX_BATCH) {
    return Response.json({ error: `send { from, label, events } with 1 to ${MAX_BATCH} events` }, { status: 400 });
  }
  const from = typeof body.from === "string" ? body.from.slice(0, 40) : "api";
  const label = typeof body.label === "string" ? body.label.slice(0, 200) : "";
  try {
    const results = await acceptEvents(body.events, from, label);
    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: String(err).slice(0, 200) }, { status: 503 });
  }
}
