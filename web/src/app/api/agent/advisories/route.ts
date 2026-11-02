import { advisoryBatch, type Selection } from "@/lib/agent/pipelines";
import { seasonFor } from "@/lib/agent/season-server";
import { actorOf, refuse } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { saveBatch, serverOverrides } from "@/lib/server/relay";
import { clampDay } from "@/lib/sim/calendar";

/**
 * Prepare an advisory batch for a day (nothing is sent): who to warn, by which channel, with what
 * message. Officer or FPO only. The batch is stored and gets an id; /api/messages sends it by that id,
 * so what is sent is exactly what was prepared here.
 */
export async function POST(req: Request) {
  const actor = await actorOf(req);
  const denied = can(actor, "prepare-advisories");
  if (denied) return refuse(denied);
  const body = (await req.json().catch(() => ({}))) as { day?: number; selection?: Selection };
  // Who to warn is decided from the server's own record, never from the request.
  const season = await seasonFor(new URL(req.url).origin, await serverOverrides());
  const sel: Selection = body.selection?.by === "hexes" && Array.isArray(body.selection.hexes) ? { by: "hexes", hexes: body.selection.hexes.map(Number).filter(Number.isInteger).slice(0, 400) }
    : body.selection?.by === "village" && Number.isInteger(body.selection.village) ? { by: "village", village: body.selection.village }
    : { by: "radar" };
  const day = clampDay(Number(body.day ?? 140));
  const batch = await advisoryBatch(season, day, sel);
  const batchId = batch.advisories.length
    ? await saveBatch(day, actor!.person.id, batch.advisories.map(({ plot, plotId, farmer, village, channel, sms, smsMr }) => ({ plot, plotId, farmer, village, channel, sms, smsMr })))
    : null;
  return Response.json({ ...batch, batchId });
}
