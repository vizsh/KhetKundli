import { runAgent, type AgentStep, type Audience } from "@/lib/agent/agent";
import { seasonFor } from "@/lib/agent/season-server";
import { clampDay } from "@/lib/sim/calendar";
import type { Overrides } from "@/lib/sim/types";

/**
 * Ask the agent about one plot. Streams the pipeline as server-sent events: one `step` per stage
 * (route, evidence, plan, compose, guard), then the `answer`. The body carries the phone's view of
 * the season (its day and overrides), so the answer matches what the farmer sees.
 */
type Body = { question?: string; plot?: number; day?: number; overrides?: Overrides; audience?: Audience; useLlm?: boolean };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const question = String(body.question ?? "").trim().slice(0, 500);
  if (!question) return Response.json({ error: "question required" }, { status: 400 });
  const origin = new URL(req.url).origin;
  const season = await seasonFor(origin, body.overrides ?? {});
  const plot = Number.isInteger(body.plot) && body.plot! >= 0 && body.plot! < season.plots.length ? body.plot! : season.heroPlot;
  const day = clampDay(Number(body.day ?? 140));
  const audience = body.audience === "officer" ? "officer" : "farmer";

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: unknown) => ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const answer = await runAgent({ question, season, plot, day, audience, useLlm: body.useLlm }, (s: AgentStep) => send("step", s));
        send("answer", answer);
      } catch (err) {
        send("error", { message: String(err) });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
