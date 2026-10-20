"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Cpu, ShieldCheck, TriangleAlert } from "lucide-react";
import type { AgentAnswer, AgentStep } from "@/lib/agent/agent";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const STAGE: Record<AgentStep["stage"], string> = { route: "Router", evidence: "Evidence", plan: "Plan", compose: "Compose", guard: "Guard", repair: "Repair", fallback: "Fallback", translate: "Marathi" };

/** Streams the agent's pipeline (POST /api/agent/ask, server-sent events) for one question. */
function useAgent(question: string | null, plot: number, day: number) {
  const overrides = useDesk((s) => s.overrides);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [answer, setAnswer] = useState<AgentAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!question) return;
    const ctrl = new AbortController();
    queueMicrotask(() => { setSteps([]); setAnswer(null); setError(null); });
    (async () => {
      try {
        const res = await fetch("/api/agent/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, plot, day, overrides }), signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error(`agent responded ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const event = block.match(/^event: (.*)$/m)?.[1];
            const data = block.match(/^data: (.*)$/m)?.[1];
            if (!event || !data) continue;
            if (event === "step") setSteps((s) => [...s, JSON.parse(data)]);
            else if (event === "answer") setAnswer(JSON.parse(data));
            else if (event === "error") setError(JSON.parse(data).message);
          }
        }
      } catch (err) {
        if (!ctrl.signal.aborted) setError(navigator.onLine ? String(err) : "offline");
      }
    })();
    return () => ctrl.abort();
    // The overrides at the moment of asking are the ones that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, plot, day]);
  return { steps, answer, error };
}

export function AgentAnswerCard({ question, plot, day }: { question: string | null; plot: number; day: number }) {
  const { steps, answer, error } = useAgent(question, plot, day);
  const reduce = useReducedMotion();
  if (!question) return null;
  if (error === "offline") return <p className="typed mt-3 text-[12px] text-ink-3">Offline: the answer above comes from your record on this phone. The reasoned answer will be ready when signal returns.</p>;

  return (
    <section className="mt-4 rounded-[4px] border-2 border-ink bg-[#fbfbf8]" aria-live="polite">
      <header className="flex items-center justify-between gap-2 border-b border-ink/20 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Cpu className="size-4 text-stamp" /> Reasoned from your record</p>
        <p className="typed text-[10.5px] text-ink-3">{answer ? `${answer.engine === "llm" ? answer.model : "rules"} · on this laptop · ${(answer.ms / 1000).toFixed(1)} s` : "local model · working"}</p>
      </header>

      {/* The pipeline, stage by stage, as the server streams it. */}
      <ol className="space-y-0.5 px-3 py-2">
        {steps.map((s, i) => (
          <motion.li key={i} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="typed flex gap-2 text-[11px] leading-[17px]">
            <span className={cn("w-[62px] shrink-0 font-bold", s.stage === "guard" ? "text-stamp" : s.stage === "fallback" ? "text-alert" : "text-ink-2")}>{STAGE[s.stage]}</span>
            <span className="min-w-0 flex-1 text-ink-2">{s.label}</span>
            <span className="shrink-0 text-ink-3">{s.ms >= 1000 ? `${(s.ms / 1000).toFixed(1)} s` : `${Math.round(s.ms)} ms`}</span>
          </motion.li>
        ))}
        {!answer && !error && <li className="typed animate-pulse text-[11px] text-ink-3">…</li>}
        {error && <li className="typed text-[11px] text-alert">{error}</li>}
      </ol>

      {answer && (
        <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="border-t border-ink/20 px-3 pb-3 pt-2.5">
          <p className="text-[16px] font-semibold leading-snug">{answer.headline}</p>
          {answer.steps.length > 0 && (
            <ol className="mt-2 space-y-1">
              {answer.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-snug">
                  <span className="grid size-5 shrink-0 place-items-center rounded-[2px] bg-ink text-[11px] font-bold text-paper">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          {answer.mr && answer.mrSource === "model" && (
            <p className="mt-2 text-[15px] leading-snug" style={{ fontFamily: "var(--font-anek-deva)" }}>{answer.mr} <span className="typed text-[10px] text-ink-3">(machine Marathi, to be checked)</span></p>
          )}
          {answer.why.length > 0 && (
            <div className="mt-2.5">
              <p className="label-form text-ink-3">Why</p>
              <ul className="mt-1 space-y-1">
                {answer.why.map((w, i) => (
                  <li key={i} className="text-[13px] leading-snug text-ink-2">
                    {w.text}{" "}
                    {w.cite.map((c) => <span key={c} className="typed ml-0.5 rounded-[2px] border border-stamp/50 px-1 text-[10px] text-stamp">{c}</span>)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {answer.citations.length > 0 && (
            <details className="mt-2">
              <summary className="typed cursor-pointer text-[11px] text-ink-3">{answer.citations.length} facts used</summary>
              <ul className="mt-1 space-y-0.5">
                {answer.citations.map((f) => <li key={f.id} className="typed text-[10.5px] leading-[15px] text-ink-2"><span className="text-stamp">[{f.id}]</span> {f.text}</li>)}
              </ul>
            </details>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {answer.guard.checks.map((c) => (
              <span key={c.name} title={c.detail} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]", c.ok ? "border-stamp/50 text-stamp" : "border-alert text-alert")}>
                {c.ok ? <Check className="size-3" /> : <TriangleAlert className="size-3" />} {c.name}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border border-ink/30 px-2 py-0.5 text-[10.5px] text-ink-2"><ShieldCheck className="size-3" /> {answer.confidence} confidence</span>
          </div>
        </motion.div>
      )}
    </section>
  );
}
