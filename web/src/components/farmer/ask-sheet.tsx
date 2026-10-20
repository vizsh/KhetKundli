"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mic, Send, UserRound, Volume2, X } from "lucide-react";
import type { Escalation } from "@/lib/channel";
import { Stamp } from "@/components/record/stamp";
import { answer, SAMPLE_QUESTIONS, type Answer } from "@/lib/voice";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function makeRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speak(text: string, lang: "mr" | "en") {
  if (typeof speechSynthesis === "undefined") return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const voice = lang === "mr"
    ? voices.find((v) => v.lang.startsWith("mr")) ?? voices.find((v) => v.lang.startsWith("hi"))
    : voices.find((v) => v.lang === "en-IN") ?? voices.find((v) => v.lang.startsWith("en"));
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = lang === "mr" ? "mr-IN" : "en-IN";
  u.rate = 0.95;
  speechSynthesis.speak(u);
  return true;
}

function Orb({ listening }: { listening: boolean }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative grid size-24 place-items-center">
      {listening && !reduce && [0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-stamp"
          initial={{ scale: 0.7, opacity: 0.7 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
        />
      ))}
      <span className={cn("grid size-20 place-items-center rounded-full text-paper transition-colors", listening ? "bg-stamp" : "bg-ink")}>
        <Mic className="size-8" />
      </span>
    </span>
  );
}

/** A question handed to the extension officer: queued until the officer's reply arrives, in their hand. */
function HandoffSlip({ item }: { item: Escalation }) {
  return (
    <div className="slip-shadow mt-3">
      <div className="perforated bg-slip px-3.5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-semibold">
            {item.reply ? "The extension officer replied" : "Handed to the extension officer"}{" "}
            <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>{item.reply ? "कृषी सहाय्यकांचे उत्तर" : "कृषी सहाय्यकांकडे पाठवले"}</span>
          </p>
          <Stamp tone="stamp" size="xs" rotate={-4}>{item.reply ? "Answered" : "Queued"}</Stamp>
        </div>
        <p className="ballpoint mt-1.5 text-[15px] leading-snug">“{item.question}”</p>
        {item.reply ? (
          <div className="mt-2 border-t border-dotted border-ink/30 pt-2">
            <p className="ballpoint text-[16px] leading-snug">{item.reply.text}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="typed text-[11px] text-ink-3">{item.reply.by}</p>
              {/* For farmers who would rather listen than read: the reply in the officer's language, aloud. */}
              <button
                type="button"
                onClick={() => speak(item.reply!.text, /[ऀ-ॿ]/.test(item.reply!.text) ? "mr" : "en")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-[3px] border-2 border-stamp px-2.5 text-[13px] font-semibold text-stamp"
              >
                <Volume2 className="size-4" /> Listen <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>ऐका</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="typed mt-1.5 text-[11.5px] text-ink-2">{item.plotId} · last {item.context.length} record entries attached · usually answered the same day</p>
        )}
      </div>
    </div>
  );
}

export function AskSheet({ open, onClose, plot }: { open: boolean; onClose: () => void; plot: number }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const day = Math.floor(t);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<(Answer & { question: string }) | null>(null);
  const [supported, setSupported] = useState(true);
  const [handedId, setHandedId] = useState<string | null>(null);
  const inbox = useDesk((s) => s.inbox);
  const escalate = useDesk((s) => s.escalate);
  const rec = useRef<Recognition | null>(null);
  const handed = handedId ? inbox.find((q) => q.id === handedId) : undefined;

  useEffect(() => {
    queueMicrotask(() => setSupported(Boolean(makeRecognition())));
    if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();
  }, []);
  useEffect(() => {
    if (!open) {
      rec.current?.stop();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    }
  }, [open]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const a = answer(season, plot, day, q);
    setResult({ ...a, question: q });
    setHandedId(a.escalate ? escalate(q).id : null);
    speak(a.mr, "mr");
  };

  const start = () => {
    const r = makeRecognition();
    if (!r) { setSupported(false); return; }
    rec.current = r;
    r.lang = "mr-IN";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      finalText = text;
      setTranscript(text);
    };
    r.onerror = () => setListening(false);
    r.onend = () => { setListening(false); if (finalText) ask(finalText); };
    setTranscript("");
    setResult(null);
    setListening(true);
    r.start();
  };
  const stop = () => rec.current?.stop();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col overflow-y-auto bg-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Ask about your plot"
        >
          <header className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
            <h2 className="flex flex-wrap items-baseline gap-x-2 text-[19px] font-semibold [font-stretch:90%]">
              Ask <span className="font-marathi text-[17px] font-normal text-ink-2">प्रश्न विचारा</span>
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-12 place-items-center rounded-full hover:bg-ink/10">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex flex-col items-center px-4 pt-6">
            <button
              type="button"
              disabled={!supported}
              onPointerDown={start}
              onPointerUp={stop}
              onPointerLeave={() => listening && stop()}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (listening) stop(); else start(); } }}
              aria-label={listening ? "Listening; release to ask" : "Hold to speak"}
              className="rounded-full disabled:opacity-40"
            >
              <Orb listening={listening} />
            </button>
            <p className="mt-2 text-center text-[14px] font-semibold">{listening ? "Listening… release to ask" : supported ? "Hold to speak, in Marathi or English" : "Voice is not available in this browser; type instead"}</p>
            <p className="text-[14px] text-ink-2" style={{ fontFamily: "var(--font-anek-deva)" }}>{listening ? "ऐकत आहे…" : "दाबून ठेवा आणि बोला"}</p>
            {transcript && <p className="ballpoint mt-3 text-center text-[18px]">“{transcript}”</p>}
          </div>

          <form
            className="mx-4 mt-4 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); ask(typed); }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Or type your question / प्रश्न लिहा"
              className="min-h-12 min-w-0 flex-1 rounded-[3px] border-2 border-ink/40 bg-paper px-3 text-[15px] outline-none focus:border-stamp"
            />
            <button type="submit" aria-label="Ask" className="grid min-h-12 w-12 place-items-center rounded-[3px] bg-ink text-paper">
              <Send className="size-5" />
            </button>
          </form>

          {!result && (
            <div className="mx-4 mt-4">
              <p className="label-form text-ink-3">Try asking <span className="normal-case tracking-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>असे विचारा</span></p>
              <ul className="mt-1.5 space-y-1.5">
                {SAMPLE_QUESTIONS.map((q) => (
                  <li key={q.en}>
                    <button type="button" onClick={() => ask(q.mr)} className="w-full rounded-[3px] border border-ink/25 px-3 py-2 text-left hover:border-ink">
                      <span className="block text-[15px]" style={{ fontFamily: "var(--font-anek-deva)" }}>{q.mr}</span>
                      <span className="block text-[12.5px] text-ink-3">{q.en}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {inbox.length > 0 && (
                <div className="mt-5">
                  <p className="label-form text-ink-3">Your questions to the officer <span className="normal-case tracking-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>अधिकाऱ्यांना विचारलेले प्रश्न</span></p>
                  <div className="mt-1.5 space-y-3">
                    {inbox.slice(0, 3).map((q) => <HandoffSlip key={q.id} item={q} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <motion.section initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-4 mb-8 mt-5">
              <p className="label-form text-ink-3">Understood <span className="normal-case tracking-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>समजले</span></p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {result.chips.map((c) => (
                  <span key={c.label} className={cn("rounded-full border-2 px-2.5 py-0.5 text-[12.5px]", c.sure ? "border-ink" : "border-dashed border-ink/40 text-ink-2")} title={c.sure ? "Heard in your question" : "Assumed from your plot record"}>
                    <span className="text-ink-3">{c.label}:</span> {c.value} <span style={{ fontFamily: "var(--font-anek-deva)" }}>{c.mr}</span>
                  </span>
                ))}
              </div>
              <div className="ruled mt-3 pb-1 pl-[52px] pr-3 pt-0" style={{ ["--rule-gap" as string]: "28px", ["--margin-x" as string]: "40px" }}>
                <p className="text-[17px] leading-[28px]" style={{ fontFamily: "var(--font-tiro-marathi), var(--font-anek-deva)" }}>{result.mr}</p>
                <p className="typed text-[13px] leading-[28px]">{result.en}</p>
              </div>
              <button type="button" onClick={() => speak(result.mr, "mr")} className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-[3px] border-2 border-stamp px-3 text-[14px] font-semibold text-stamp">
                <Volume2 className="size-5" /> Read aloud again <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>पुन्हा ऐका</span>
              </button>
              {result.sources.length > 0 && (
                <p className="mt-2 text-[12px] text-ink-3">From your record <span style={{ fontFamily: "var(--font-anek-deva)" }}>तुमच्या नोंदीतून</span>: {result.sources.join(" · ")}{result.sourcesMr ? <span className="block" style={{ fontFamily: "var(--font-anek-deva)" }}>{result.sourcesMr.join(" · ")}</span> : null}</p>
              )}
              {handed ? (
                <HandoffSlip item={handed} />
              ) : (
                <button
                  type="button"
                  onClick={() => setHandedId(escalate(result.question).id)}
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] border-2 border-ink px-3 text-[14px] font-semibold"
                >
                  <UserRound className="size-5" /> Ask the extension officer instead <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>कृषी सहाय्यकांना विचारा</span>
                </button>
              )}
            </motion.section>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
