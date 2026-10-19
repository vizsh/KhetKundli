"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Send } from "lucide-react";
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

function Item({ q }: { q: Escalation }) {
  const replyTo = useDesk((s) => s.replyTo);
  const selectPlot = useDesk((s) => s.selectPlot);
  const [text, setText] = useState("");
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
