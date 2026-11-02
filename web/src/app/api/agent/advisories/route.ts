import { advisoryBatch, type Selection } from "@/lib/agent/pipelines";
import { seasonFor } from "@/lib/agent/season-server";
import { serverOverrides } from "@/lib/server/relay";
import { clampDay } from "@/lib/sim/calendar";

/** Prepare an advisory batch for a day (nothing is sent): who to warn, by which channel, with what message. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { day?: number; selection?: Selection };
  // Who to warn is decided from the server's own record, never from the request.
  const season = await seasonFor(new URL(req.url).origin, await serverOverrides());
  const sel: Selection = body.selection?.by === "hexes" && Array.isArray(body.selection.hexes) ? { by: "hexes", hexes: body.selection.hexes.map(Number) }
    : body.selection?.by === "village" && Number.isInteger(body.selection.village) ? { by: "village", village: body.selection.village }
    : { by: "radar" };
  return Response.json(await advisoryBatch(season, clampDay(Number(body.day ?? 140)), sel));
}
