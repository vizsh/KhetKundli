"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCheck, Clock3, MessageSquareText, RadioTower, Send } from "lucide-react";
import { Stamp } from "@/components/record/stamp";
import type { Selection } from "@/lib/agent/pipelines";
import { prepareAdvisories, sendAdvisories, type AdvisoryBatch } from "@/lib/deliver";
import { geo } from "@/lib/geo";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const hm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "");

/**
 * The officer's advisory console: prepare a batch (plots under a radar warning, or one village after a
 * field visit), read exactly what will be sent in English and Marathi, approve, and watch the receipts.
 * Nothing is sent without the officer's approval.
 */
export function Advisories() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const overrides = useDesk((s) => s.overrides);
  const messages = useDesk((s) => s.messages);
  const day = Math.floor(t);
  const heroVillage = season.plots[season.heroPlot].village;
  const [source, setSource] = useState<"radar" | "village">("radar");
  const [village, setVillage] = useState(heroVillage);
  const [batch, setBatch] = useState<AdvisoryBatch | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [state, setState] = useState<"idle" | "preparing" | "sending" | "error">("idle");
  const [sentBatch, setSentBatch] = useState<string | null>(null);

  const villages = useMemo(() => [...new Set(season.plots.map((p) => p.village))].sort((a, b) => geo.villages[a].name.localeCompare(geo.villages[b].name)), [season]);
  const sent = useMemo(() => (sentBatch ? messages.filter((m) => m.batch === sentBatch) : []), [messages, sentBatch]);
  const chosen = batch ? batch.advisories.filter((a) => !skip.has(a.plot)) : [];

  const prepare = async () => {
    setState("preparing");
    setSentBatch(null);
    try {
      const sel: Selection = source === "radar" ? { by: "radar" } : { by: "village", village };
      setBatch(await prepareAdvisories(day, sel, overrides));
      setSkip(new Set());
      setState("idle");
    } catch {
      setState("error");
    }
  };
  const send = async () => {
    if (!chosen.length) return;
    setState("sending");
    try {
      const r = await sendAdvisories(day, chosen);
      setSentBatch(r.batch);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const delivered = sent.filter((m) => m.deliveredAt).length;
  const read = sent.filter((m) => m.readAt).length;
  const preview = batch?.advisories.find((a) => a.plot === season.heroPlot) ?? batch?.advisories[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/20 px-4 py-2.5">
        <div role="radiogroup" aria-label="Who to advise" className="flex overflow-hidden rounded-[2px] border-2 border-ink">
          {(["radar", "village"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={source === k} onClick={() => setSource(k)} className={cn("px-2.5 py-1 text-[12.5px] font-semibold", source === k ? "bg-ink text-paper" : "hover:bg-ink/10")}>
              {k === "radar" ? "Radar warnings" : "One village"}
            </button>
          ))}
        </div>
        {source === "village" && (
          <select value={village} onChange={(e) => setVillage(Number(e.target.value))} aria-label="Village" className="min-h-8 rounded-[2px] border-2 border-ink/30 bg-paper px-1.5 text-[12.5px]">
            {villages.map((v) => <option key={v} value={v}>{geo.villages[v].name}</option>)}
          </select>
        )}
        <button type="button" onClick={prepare} disabled={state === "preparing"} className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-[2px] border-2 border-stamp px-2.5 text-[12.5px] font-semibold text-stamp disabled:opacity-50">
          <RadioTower className="size-3.5" /> {state === "preparing" ? "Preparing…" : batch ? "Prepare again" : "Prepare tonight's batch"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!batch && (
          <p className="px-4 py-4 text-[13px] leading-relaxed text-ink-3">
            Prepare a batch to see who would be warned, by app or SMS, and exactly what each message says. Doses come from the spray table; every message is checked before you approve it. Warnings from the 72-hour forecast are sent the same way.
          </p>
        )}
        {state === "error" && <p className="px-4 py-2 text-[12.5px] text-alert">The server did not answer. Check the status page, then try again.</p>}
        {batch && (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3">
              <p className="text-[14px] font-semibold">{batch.plots ? `${batch.plots} ${batch.plots === 1 ? "plot" : "plots"} for ${batch.day}` : `Nobody to warn on ${batch.day}`}</p>
              {batch.plots > 0 && <p className="typed text-[11px] text-ink-3">{batch.byChannel.app} app · {batch.byChannel.sms} SMS · {batch.byVillage.map(([v, n]) => `${v} ${n}`).join(", ")}</p>}
              {batch.plots > 0 && <span className={cn("typed text-[10.5px]", batch.guardPassed ? "text-stamp" : "text-alert")}>{batch.guardPassed ? "✓ checks passed" : "check the messages"}</span>}
            </div>
            {!batch.plots && <p className="px-4 pb-3 pt-1 text-[12.5px] text-ink-3">No plot is in a cell on warning or outbreak, or every one has sprayed in the last ten days. Choose a village to send a preventive advisory after a field visit.</p>}
            {preview && (
              <div className="mx-4 mt-2 rounded-[2px] border border-ink/25 bg-slip px-3 py-2">
                <p className="label-form flex items-center gap-1 text-ink-3"><MessageSquareText className="size-3" /> The message, {preview.farmer}</p>
                <p className="mt-1 text-[14px] leading-snug" style={{ fontFamily: "var(--font-anek-deva)" }}>{preview.smsMr}</p>
                <p className="typed mt-0.5 text-[11.5px] leading-snug text-ink-2">{preview.sms}</p>
              </div>
            )}
            <ul className="mt-2">
              {batch.advisories.map((a) => {
                const m = sent.find((x) => x.plot === a.plot);
                const off = skip.has(a.plot);
                return (
                  <li key={a.plot} className={cn("grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 border-t border-ink/10 px-4 py-1.5", off && "opacity-45")}>
                    <input type="checkbox" aria-label={`Send to ${a.farmer}`} disabled={Boolean(sentBatch)} checked={!off} onChange={() => setSkip((s0) => { const s1 = new Set(s0); if (s1.has(a.plot)) s1.delete(a.plot); else s1.add(a.plot); return s1; })} className="size-4 accent-[var(--color-stamp)]" />
                    <span className="min-w-0 truncate text-[13px]">
                      <span className="font-semibold">{a.farmer}</span> <span className="typed text-[11px] text-ink-3">{a.plotId} · {a.village}</span>
                      {a.plot === season.heroPlot && <span className="typed ml-1 rounded-[2px] bg-stamp px-1 text-[10px] text-paper">demo phone</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={cn("typed rounded-[2px] border px-1 text-[10px]", a.channel === "app" ? "border-stamp/50 text-stamp" : "border-ink/40 text-ink-2")}>{a.channel.toUpperCase()}</span>
                      {m && (
                        <span className="typed flex items-center gap-1 text-[10.5px] text-ink-2" title={m.simulated ? "Receipt from the gateway simulator" : "Receipt from the phone"}>
                          {m.readAt ? <CheckCheck className="size-3.5 text-stamp" /> : m.deliveredAt ? <Check className="size-3.5" /> : <Clock3 className="size-3.5 text-ink-3" />}
                          {m.readAt ? `read ${hm(m.readAt)}` : m.deliveredAt ? `delivered ${hm(m.deliveredAt)}` : "sent"}
                          {m.simulated && <span className="text-ink-3">sim</span>}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {batch && batch.plots > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink px-4 py-2.5">
          <AnimatePresence mode="wait">
            {sentBatch ? (
              <motion.p key="sent" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="typed text-[11.5px] text-ink-2">
                Sent {sent.length} · delivered {delivered} · read {read}
              </motion.p>
            ) : (
              <motion.p key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="typed text-[11.5px] text-ink-3">{chosen.length} of {batch.plots} selected</motion.p>
            )}
          </AnimatePresence>
          {sentBatch ? (
            <Stamp tone="stamp" size="sm" rotate={-4}>Sent</Stamp>
          ) : (
            <button type="button" onClick={send} disabled={!chosen.length || state === "sending"} className="inline-flex min-h-10 items-center gap-1.5 rounded-[2px] bg-ink px-3 text-[13px] font-semibold text-paper disabled:opacity-40">
              <Send className="size-4" /> {state === "sending" ? "Sending…" : `Approve and send ${chosen.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
