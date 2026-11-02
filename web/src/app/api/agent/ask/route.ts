import { runAgent, type AgentStep, type Audience } from "@/lib/agent/agent";
import { seasonFor } from "@/lib/agent/season-server";
import { logAnswer } from "@/lib/server/agent-log";
import { serverOverrides } from "@/lib/server/relay";
import { clampDay } from "@/lib/sim/calendar";

/**
 * Ask the agent about one plot. Streams the pipeline as server-sent events: one `step` per stage
 * (route, evidence, plan, compose, guard), then the `answer`. The body names the plot and the day; the
 * record is the server's own (season events in the event store), so a client cannot make the agent
 * answer from a record that does not exist.
 */
type Body = { question?: string; plot?: number; day?: number; audience?: Audience; useLlm?: boolean };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const question = String(body.question ?? "").trim().slice(0, 500);
  if (!question) return Response.json({ error: "question required" }, { status: 400 });
  const origin = new URL(req.url).origin;
  // The record comes from the server's own events, never from the request.
  const season = await seasonFor(origin, await serverOverrides());
  const plot = Number.isInteger(body.plot) && body.plot! >= 0 && body.plot! < season.plots.length ? body.plot! : season.heroPlot;
  const day = clampDay(Number(body.day ?? 140));
  const audience = body.audience === "officer" ? "officer" : "farmer";

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: unknown) => ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const answer = await runAgent({ question, season, plot, day, audience, useLlm: body.useLlm }, (s: AgentStep) => send("step", s));
        let logId: number | undefined;
        try { logId = logAnswer(answer, plot, day); } catch { /* logging never blocks an answer */ }
        send("answer", { ...answer, logId });
      } catch (err) {
        send("error", { message: String(err) });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
