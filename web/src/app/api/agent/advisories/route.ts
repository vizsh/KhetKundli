import { advisoryBatch, type Selection } from "@/lib/agent/pipelines";
import { seasonFor } from "@/lib/agent/season-server";
import { clampDay } from "@/lib/sim/calendar";
import type { Overrides } from "@/lib/sim/types";

/** Prepare an advisory batch for a day (nothing is sent): who to warn, by which channel, with what message. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { day?: number; overrides?: Overrides; selection?: Selection };
  const season = await seasonFor(new URL(req.url).origin, body.overrides ?? {});
  const sel: Selection = body.selection?.by === "hexes" && Array.isArray(body.selection.hexes) ? { by: "hexes", hexes: body.selection.hexes.map(Number) }
    : body.selection?.by === "village" && Number.isInteger(body.selection.village) ? { by: "village", village: body.selection.village }
    : { by: "radar" };
  return Response.json(await advisoryBatch(season, clampDay(Number(body.day ?? 140)), sel));
}
