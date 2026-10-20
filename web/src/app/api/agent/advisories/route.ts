import { advisoryBatch } from "@/lib/agent/pipelines";
import { seasonFor } from "@/lib/agent/season-server";
import { clampDay } from "@/lib/sim/calendar";
import type { Overrides } from "@/lib/sim/types";

/** Run the daily advisory pipeline for a day: who to warn, by which channel, with what message. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { day?: number; overrides?: Overrides };
  const season = await seasonFor(new URL(req.url).origin, body.overrides ?? {});
  return Response.json(await advisoryBatch(season, clampDay(Number(body.day ?? 140))));
}
