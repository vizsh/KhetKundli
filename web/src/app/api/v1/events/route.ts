import { connection } from "next/server";
import { MAX_BATCH } from "@/lib/events";
import { actorOf, limited, readJson, refuse, tooMany } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { eventStore } from "@/lib/server/event-store";
import { acceptEvents } from "@/lib/server/relay";
import { heroPlot } from "@/lib/server/seed";

/**
 * The season record, version 1. Signed in only.
 *
 * GET  /api/v1/events?after=<seq>&limit=<n>  events in arrival order after a cursor, and the next cursor
 * POST /api/v1/events  { from, label, events: [...] }  one verdict per event: accepted (with its
 *      sequence number), duplicate (already stored; safe to drop from an outbox) or rejected (with the
 *      reason, including an event about a plot that is not the sender's)
 */
export async function GET(req: Request) {
  await connection();
  const denied = can(await actorOf(req), "read-season");
  if (denied) return refuse(denied);
  const url = new URL(req.url);
  const after = Math.max(0, Math.floor(Number(url.searchParams.get("after") ?? 0)) || 0);
  const limit = Math.min(5000, Math.max(1, Math.floor(Number(url.searchParams.get("limit") ?? 1000)) || 1000));
  return Response.json(await (await eventStore()).since(after, limit));
}

export async function POST(req: Request) {
  const actor = await actorOf(req);
  const denied = can(actor, "read-season");
  if (denied) return refuse(denied);
  const wait = limited(`events:${actor!.person.id}`, 120, 60_000);
  if (wait) return tooMany(wait);
  const read = await readJson(req);
  if (!read.ok) return read.response;
  const body = read.body as { from?: unknown; label?: unknown; events?: unknown } | null;
  if (!body || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > MAX_BATCH) {
    return Response.json({ error: `send { from, label, events } with 1 to ${MAX_BATCH} events` }, { status: 400 });
  }
  const from = typeof body.from === "string" ? body.from.slice(0, 40) : "api";
  const label = typeof body.label === "string" ? body.label.slice(0, 200) : "";
  try {
    return Response.json({ results: await acceptEvents(body.events, from, label, actor, heroPlot()) });
  } catch (err) {
    return Response.json({ error: String(err).slice(0, 200) }, { status: 503 });
  }
}
