"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cpu, Send } from "lucide-react";
import { Stamp } from "@/components/record/stamp";
import type { Escalation } from "@/lib/channel";
import { fmtDay } from "@/lib/sim/calendar";
import { SPRAYS } from "@/lib/sim/rules";
import { useDesk } from "@/lib/store";

// Quick replies the officer can send in one tap; doses come from the same fixed rules table as the app.
const QUICK = [
  `Spray ${SPRAYS.curative.product}, ${SPRAYS.curative.dose}, tomorrow at 06:00 if dry. Send me a leaf photo in 3 days.`,
  "I will visit your plot tomorrow morning. Keep one affected leaf aside for me.",
  "Skip irrigation for 2 days and remove fallen fruit from under the trees.",
];
// For a sale slip dispute: the officer takes it up with the agent; the app never accuses anyone itself.
const QUICK_SLIP = [
  "Keep the original slip. I will call the agent today about the charges above the agreed rate card.",
  "Ask the agent for the refund against this patti number, in writing. Tell me if it is refused.",
  "I have sent this to the FPO and the APMC office; they will raise it at the next auction.",
];

/** Ask the agent for a draft reply (audience: officer); the officer reads and edits it before sending. */
async function draftReply(q: Escalation, overrides: unknown) {
  const res = await fetch("/api/agent/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q.question, plot: q.plot, day: q.day, overrides, audience: "officer" }) });
  const body = await res.text();
  const data = body.split(String.fromCharCode(10, 10)).find((b) => b.startsWith("event: answer"))?.split("data: ")[1];
  if (!data) throw new Error("no draft");
  const a = JSON.parse(data) as { headline: string; steps: string[]; guard: { passed: boolean }; engine: string; ms: number };
  return { text: [a.headline, ...a.steps].join(" "), note: `${a.engine === "llm" ? "Drafted by the local model" : "Drafted from the rules"} · ${a.guard.passed ? "checks passed" : "check before sending"} · ${(a.ms / 1000).toFixed(1)} s` };
}

function Item({ q }: { q: Escalation }) {
  const replyTo = useDesk((s) => s.replyTo);
  const selectPlot = useDesk((s) => s.selectPlot);
  const overrides = useDesk((s) => s.overrides);
  const [text, setText] = useState("");
  const [drafting, setDrafting] = useState<string | null>(null);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-ink/20 px-4 py-3 last:border-b-0"
    >
      <div className="flex items-baseline justify-between gap-2">
        <button type="button" onClick={() => selectPlot(q.plot)} className="text-left text-[13.5px] font-semibold hover:underline">
          {q.farmer} <span className="typed font-normal text-ink-3">{q.plotId} · {fmtDay(q.day)}</span>
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          {q.topic === "slip" && <span className="label-form text-[10px] text-ink-3">Sale slip</span>}
          <Stamp tone={q.reply ? "stamp" : "alert"} size="xs" rotate={q.reply ? -4 : 3} press={false}>{q.reply ? "Answered" : "Open"}</Stamp>
        </span>
      </div>
      <p className="ballpoint mt-1 text-[16px] leading-snug">“{q.question}”</p>
      {q.context.length > 0 && <p className="typed mt-1 text-[11px] text-ink-3">{q.topic === "slip" ? "Slip: " : "Record: "}{q.context.map((c) => c.replace(/^(\d+):/, (_, d) => `${fmtDay(Number(d))}:`)).join(" · ")}</p>}
      {q.reply ? (
        <p className="ballpoint mt-2 text-[14.5px] leading-snug">
          <span className="typed mr-1 text-[11px] text-ink-3">Reply:</span>{q.reply.text}
        </p>
      ) : (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            {(q.topic === "slip" ? QUICK_SLIP : QUICK).map((r) => (
              <button key={r} type="button" onClick={() => setText(r)} className="rounded-[2px] border border-ink/30 px-2 py-1 text-left text-[11.5px] leading-snug hover:border-ink" title={r}>
                {r.length > 46 ? `${r.slice(0, 44)}…` : r}
              </button>
            ))}
          </div>
          {q.topic !== "slip" && (
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                disabled={drafting === "…"}
                onClick={async () => {
                  setDrafting("…");
                  try {
                    const d = await draftReply(q, overrides);
                    setText(d.text);
                    setDrafting(d.note);
                  } catch {
                    setDrafting("The local model is not reachable; use a quick reply");
                  }
                }}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border-2 border-stamp px-2 text-[12px] font-semibold text-stamp disabled:opacity-50"
              >
                <Cpu className="size-3.5" /> {drafting === "…" ? "Drafting from the record…" : "Draft with the agent"}
              </button>
              {drafting && drafting !== "…" && <span className="typed text-[10.5px] text-ink-3">{drafting}</span>}
            </div>
          )}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (text.trim()) replyTo(q.id, text.trim()); }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Reply to the farmer"
              aria-label={`Reply to ${q.farmer}`}
              className="min-h-10 min-w-0 flex-1 rounded-[2px] border-2 border-ink/30 bg-paper px-2.5 text-[13.5px] outline-none focus:border-stamp"
            />
            <button type="submit" disabled={!text.trim()} className="inline-flex min-h-10 items-center gap-1.5 rounded-[2px] bg-ink px-3 text-[13px] font-semibold text-paper disabled:opacity-40">
              <Send className="size-4" /> Send
            </button>
          </form>
        </div>
      )}
    </motion.li>
  );
}

export function Inbox() {
  const inbox = useDesk((s) => s.inbox);
  if (!inbox.length) {
    return (
      <p className="px-4 py-4 text-[13px] leading-relaxed text-ink-3">
        No questions waiting. When a farmer&apos;s question is beyond what the app can answer from her record, it lands here with her plot and recent entries attached.
      </p>
    );
  }
  return (
    <ol>
      <AnimatePresence initial={false}>
        {inbox.map((q) => <Item key={q.id} q={q} />)}
      </AnimatePresence>
    </ol>
  );
}
