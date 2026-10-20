"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, Check as Tick, ImageUp, Loader2, Send, Share2, Wifi, WifiOff, X } from "lucide-react";
import { Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { mrDay } from "@/lib/farmer";
import { prepareImage, readSlip, slipReader, type OcrProgress } from "@/lib/ocr";
import { checkSlip, disputeNote, owed, parseSlip, rateCardFor, toSaleSlip, type Box, type Check, type ChargeKind, type Slip, type SlipNumber } from "@/lib/patti";
import { fmtDay } from "@/lib/sim/calendar";
import { GRADE_FACTOR } from "@/lib/sim/rules";
import type { SaleSlip } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
const KIND_MR: Record<ChargeKind, string> = { commission: "अडत", hamali: "हमाली", weighment: "तोलाई", freight: "गाडी भाडे", other: "इतर" };
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type Sample = { src: string; title: string; credit: string };
type Photo = { url: string; w: number; h: number };
type Read = { ms: number; confidence: number; marathi: boolean };

/** How much of a slip a read found: the six key numbers and whether any charges came out. */
const found = (s: Slip) => [s.gross, s.total, s.net, s.crates, s.kg, s.rate].filter((v) => v !== undefined).length + (s.charges.length ? 1 : 0);

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    queueMicrotask(() => setOnline(navigator.onLine));
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

/** A hand-drawn ring, a little over a full turn, like an officer's red pen round a figure. */
function ringPath(b: Box, pad = 10) {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const rx = (b.x1 - b.x0) / 2 + pad * 1.6, ry = (b.y1 - b.y0) / 2 + pad;
  return `M ${cx + rx} ${cy + ry * 0.1} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy - ry * 0.05} A ${rx} ${ry} 0 0 1 ${cx + rx * 0.92} ${cy - ry * 0.55}`;
}

function Marks({ photo, slip, checks }: { photo: Photo; slip: Slip; checks: Check[] }) {
  const reduce = useReducedMotion();
  const boxOf = (c: Check): Box | undefined =>
    c.charge !== undefined ? slip.charges[c.charge]?.box : c.id === "gross" || c.id === "net" || c.id === "total" ? slip.boxes[c.id as SlipNumber] : undefined;
  const marks = checks.flatMap((c) => {
    const b = boxOf(c);
    return b && c.tone !== "info" ? [{ c, b }] : [];
  });
  return (
    <svg viewBox={`0 0 ${photo.w} ${photo.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {marks.map(({ c, b }, i) =>
        c.tone === "flag" ? (
          <motion.path
            key={c.id}
            d={ringPath(b)}
            fill="none"
            stroke="var(--alert)"
            strokeWidth={2.4}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.95 }}
            transition={{ duration: 0.55, delay: 0.25 + i * 0.12, ease: "easeOut" }}
            style={{ transformBox: "fill-box", transformOrigin: "center", rotate: -2 }}
          />
        ) : (
          <motion.path
            key={c.id}
            d={`M ${b.x1 + 10} ${(b.y0 + b.y1) / 2} l 6 7 l 13 -17`}
            fill="none"
            stroke="var(--stamp)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25, delay: 0.2 + i * 0.08 }}
          />
        ),
      )}
    </svg>
  );
}

/** A number on the slip: typed as read, ballpoint once the farmer corrects it, dotted red when the reader was unsure. */
function NumCell({ value, conf, edited, label, onChange, className, corrected }: { value?: number; conf?: number; edited: boolean; label: string; onChange: (v: number | undefined) => void; className?: string; corrected?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === undefined ? "" : value.toLocaleString("en-IN"));
  const unsure = !edited && conf !== undefined && conf < 75;
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={shown}
      placeholder="type"
      title={corrected ?? (unsure ? "The reader was not sure of this number. Check it against the slip." : undefined)}
      onFocus={() => setDraft(value === undefined ? "" : String(value))}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        const raw = e.target.value.replace(/,/g, "").trim();
        const v = Number(raw);
        if (!raw) onChange(undefined);
        else if (Number.isFinite(v)) onChange(v);
      }}
      className={cn(
        "min-h-9 w-full min-w-0 rounded-[2px] bg-transparent px-1 text-right outline-none placeholder:text-ink-3/60 focus:bg-paper-2",
        edited ? "ballpoint text-[16px]" : "typed text-[13.5px]",
        unsure && "underline decoration-alert decoration-dotted decoration-2 underline-offset-4",
        !edited && corrected && "underline decoration-stamp decoration-dotted decoration-2 underline-offset-4",
        className,
      )}
    />
  );
}

export function SlipCheck({ open, onClose, plot }: { open: boolean; onClose: () => void; plot: number }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const fileSlip = useDesk((s) => s.fileSlip);
  const escalate = useDesk((s) => s.escalate);
  const setDay = useDesk((s) => s.setDay);
  const online = useOnline();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [reader, setReader] = useState<{ state: "loading" | "ready" | "error"; progress: number; error?: string }>({ state: "loading", progress: 0 });
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [reading, setReading] = useState<number | null>(null);
  const [marathiPass, setMarathiPass] = useState(false);
  const [read, setRead] = useState<Read | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [filed, setFiled] = useState<SaleSlip | null>(null);
  const [sent, setSent] = useState(false);
  const [shared, setShared] = useState<"" | "shared" | "copied">("");
  const file = useRef<HTMLInputElement>(null);
  const day = Math.floor(t);

  useEffect(() => {
    if (!open) return;
    fetch("/samples/slips.json").then((r) => r.json()).then(setSamples).catch(() => setSamples([]));
    let live = true;
    slipReader((p: OcrProgress) => {
      if (!live) return;
      if (p.status === "recognizing text") setReading(p.progress);
      else setReader((r) => (r.state === "ready" ? r : { ...r, progress: p.status.startsWith("loading language") ? 0.4 + p.progress * 0.5 : p.status.startsWith("initializing api") ? 0.95 : Math.max(r.progress, p.progress * 0.4) }));
    })
      .then(() => live && setReader({ state: "ready", progress: 1 }))
      .catch((e: unknown) => live && setReader({ state: "error", progress: 0, error: e instanceof Error ? e.message : String(e) }));
    return () => { live = false; };
  }, [open]);

  const reset = () => {
    setPhoto(null);
    setSlip(null);
    setRead(null);
    setReading(null);
    setEdited(new Set());
    setFiled(null);
    setSent(false);
    setShared("");
  };
  const close = () => { reset(); onClose(); };

  const analyse = async (img: HTMLImageElement) => {
    reset();
    const p = prepareImage(img, img.naturalWidth, img.naturalHeight);
    setPhoto({ url: p.url, w: p.w, h: p.h });
    setReading(0);
    try {
      // English first; a slip printed in Marathi reads as noise (few fields, low confidence), so read it
      // again with the Marathi model and keep whichever read found more.
      const r = await readSlip(p.canvas);
      let best = { slip: parseSlip(r.lines), r, marathi: false };
      if (found(best.slip) < 4 || r.confidence < 60) {
        setMarathiPass(true);
        setReading(0);
        const r2 = await readSlip(p.canvas, ["mar", "eng"]);
        const s2 = parseSlip(r2.lines);
        if (found(s2) > found(best.slip)) best = { slip: s2, r: { ...r2, ms: r.ms + r2.ms }, marathi: true };
      }
      setSlip(best.slip);
      setRead({ ms: best.r.ms, confidence: best.r.confidence, marathi: best.marathi });
    } catch (e) {
      setReader({ state: "error", progress: 0, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setReading(null);
      setMarathiPass(false);
    }
  };

  const loadImage = (src: string) => {
    const img = new Image();
    img.onload = () => void analyse(img);
    img.src = src;
  };

  const card = slip ? rateCardFor(season, plot, slip.market) : null;
  const modal = slip?.day !== undefined ? season.prices[slip.market][slip.day] * GRADE_FACTOR[slip.grade ?? "A"] : undefined;
  const checks = slip && card ? checkSlip(slip, card, modal) : [];
  const extra = owed(checks);
  const flags = checks.filter((c) => c.tone === "flag");
  const sale = slip ? toSaleSlip(slip, checks, plot, day) : null;
  const unread = slip && (slip.gross === undefined || slip.crates === undefined || slip.kg === undefined || slip.rate === undefined);

  const setNum = (k: SlipNumber, v: number | undefined) => {
    setSlip((s) => (s ? { ...s, [k]: v } : s));
    setEdited((e) => new Set(e).add(k));
    setFiled(null);
  };
  const setCharge = (i: number, v: number | undefined) => {
    setSlip((s) => (s ? { ...s, charges: s.charges.map((c, j) => (j === i ? { ...c, amount: v ?? 0, unread: v === undefined || undefined, repaired: undefined } : c)) } : s));
    setEdited((e) => new Set(e).add(`c${i}`));
    setFiled(null);
  };

  const note = slip ? disputeNote(slip, checks) : null;
  const sendToOfficer = () => {
    if (!slip || !note) return;
    const question = note.en.length > 500 ? `${note.en.slice(0, 497)}…` : note.en;
    escalate(question, {
      topic: "slip",
      context: [
        `Patti ${slip.pattiNo ?? "?"}${slip.day !== undefined ? `, ${fmtDay(slip.day)}` : ""}${slip.agent ? `, ${slip.agent}` : ""}`,
        `${slip.crates ?? "?"} crates, ${slip.kg ?? "?"} kg at ₹${slip.rate ?? "?"}`,
        `Gross ${inr(slip.gross ?? 0)}, net ${inr(slip.net ?? 0)}`,
        `${inr(extra)} above the rate card`,
      ],
    });
    setSent(true);
  };
  const share = async () => {
    if (!note) return;
    const text = `${note.en}\n\n${note.mr}`;
    try {
      if (navigator.share) { await navigator.share({ text }); setShared("shared"); }
      else { await navigator.clipboard.writeText(text); setShared("copied"); }
    } catch { /* the farmer closed the share sheet */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-x-0 bottom-0 top-0 z-50 mx-auto flex max-w-[480px] flex-col overflow-y-auto bg-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Check a sale slip"
        >
          <header className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
            <h2 className="flex flex-wrap items-baseline gap-x-2 text-[19px] font-semibold [font-stretch:90%]">
              Check a sale slip <span className="font-marathi text-[17px] font-normal text-ink-2">पट्टी तपासा</span>
            </h2>
            <button type="button" onClick={close} aria-label="Close slip check" className="grid size-12 place-items-center rounded-full hover:bg-ink/10">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex items-center justify-between gap-2 border-b border-ink/15 bg-paper-2 px-4 py-2 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-1.5 font-semibold">
              {online ? <Wifi className="size-4 shrink-0" /> : <WifiOff className="size-4 shrink-0 text-alert" />}
              <span className="truncate">Read on this phone <span className="font-normal" style={MR}>फोनवरच वाचते</span></span>
            </span>
            <span className="typed shrink-0 whitespace-nowrap text-[11.5px] text-ink-3">
              {reader.state === "ready" ? "English ready · मराठी on demand" : reader.state === "loading" ? `loading ${Math.round(reader.progress * 100)}%` : "failed to load"}
            </span>
          </div>

          <div className="px-4 pt-3">
            {photo ? (
              <div className="relative mx-auto w-full max-w-[400px] overflow-hidden border border-ink/30 bg-board-deep">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="The sale slip" className="block h-auto w-full" />
                {slip && <Marks photo={photo} slip={slip} checks={checks} />}
                {reading !== null && (
                  <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-3 py-2 text-[12.5px] text-paper">
                    <Loader2 className="mr-1.5 inline size-3.5 animate-spin" />
                    {reader.state !== "ready" ? "Loading the reader…" : marathiPass ? `Reading again in Marathi… ${Math.round(reading * 100)}%` : `Reading the slip… ${Math.round(reading * 100)}%`}
                    <span className="ml-1.5" style={MR}>पट्टी वाचत आहे</span>
                    <span className="mt-1.5 block h-[3px] bg-paper/25"><span className="block h-full bg-paper transition-[width]" style={{ width: `${Math.round((reader.state === "ready" ? reading : reader.progress) * 100)}%` }} /></span>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative mx-auto grid aspect-[4/3] w-full max-w-[400px] place-items-center border-2 border-dashed border-ink/50 bg-paper-2 px-8 text-center">
                <p className="text-[13px] uppercase tracking-[0.08em] text-ink-3 [font-stretch:85%]">
                  Affix the sale slip here
                  <span className="mt-1 block font-marathi text-[15px] normal-case tracking-normal">पूर्ण पट्टी, सपाट आणि उजेडात</span>
                </p>
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { if (file.current) { file.current.setAttribute("capture", "environment"); file.current.click(); } }} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] bg-ink text-[15px] font-bold text-paper active:scale-[0.99]">
                <Camera className="size-5" /> Camera <span className="font-normal" style={MR}>कॅमेरा</span>
              </button>
              <button type="button" onClick={() => { if (file.current) { file.current.removeAttribute("capture"); file.current.click(); } }} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border-2 border-ink text-[15px] font-bold active:scale-[0.99]">
                <ImageUp className="size-5" /> Photo <span className="font-normal" style={MR}>फोटो निवडा</span>
              </button>
              <input
                ref={file}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadImage(URL.createObjectURL(f));
                  e.target.value = "";
                }}
              />
            </div>

            {samples.length > 0 && (
              <div className="mt-3">
                <p className="label-form text-ink-3">No slip to hand? Try a specimen <span className="normal-case tracking-normal" style={MR}>नमुना पट्टी</span></p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {samples.map((s) => (
                    <button key={s.src} type="button" onClick={() => loadImage(s.src)} className="flex flex-col items-start gap-1 rounded-[2px] border border-ink/30 p-1.5 text-left hover:border-ink" title={s.credit}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.src} alt="" className="h-14 w-full shrink-0 rounded-[1px] object-cover object-top" />
                      <span className="text-[12.5px] font-semibold leading-tight">{s.title}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-ink-3">Specimens made for this demo; the agent named on them is fictitious.</p>
              </div>
            )}
            {reader.state === "error" && <p className="mt-2 text-[12.5px] text-alert">The slip reader could not start: {reader.error}. Run <span className="typed">npm install</span> to fetch its files.</p>}
          </div>

          {slip && card && read && (
            <motion.section initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-4 mb-8 mt-4 border-t-2 border-ink pt-3">
              {unread ? (
                <p className="text-[15px] font-semibold leading-snug text-alert">
                  Could not read every number. Type the missing ones below, or retake the photo flat and in daylight.
                  <span className="mt-1 block font-normal" style={MR}>काही आकडे वाचता आले नाहीत; खाली भरा किंवा पुन्हा फोटो घ्या.</span>
                </p>
              ) : extra > 0 ? (
                <div className="flex items-end justify-between gap-3">
                  <p className="leading-tight">
                    <span className="typed block text-[34px] font-bold text-alert">{inr(extra)}</span>
                    <span className="block text-[15px] font-semibold">charged above the agreed rate card</span>
                    <span className="block text-[15px]" style={MR}>ठरलेल्या दरापेक्षा जास्त कापले</span>
                  </p>
                  <Stamp tone="alert" size="sm" rotate={4}>{flags.length} to ask</Stamp>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[16px] font-semibold leading-tight">
                    Every deduction as agreed
                    <span className="block text-[15px] font-normal" style={MR}>सर्व कपात ठरल्याप्रमाणे</span>
                  </p>
                  <Stamp tone="stamp" size="sm" rotate={-4}>Checked</Stamp>
                </div>
              )}
              <p className="typed mt-1.5 text-[11.5px] text-ink-3">
                read on this phone in {(read.ms / 1000).toFixed(1)} s{read.marathi ? " · Marathi + English" : ""} · {read.confidence}% sure · checked against the pooled-run rate card
              </p>

              <div className="mt-3 border border-ink/30">
                <div className="grid grid-cols-3 divide-x divide-ink/20 border-b border-ink/30">
                  {(
                    [
                      ["crates", "Crates", "क्रेट"],
                      ["kg", "Weight, kg", "वजन"],
                      ["rate", "Rate, ₹/kg", "भाव"],
                    ] as const
                  ).map(([k, en, mr]) => (
                    <label key={k} className="block px-2 pb-1 pt-1.5">
                      <span className="label-form block text-[10px] text-ink-3">{en} <span className="normal-case tracking-normal" style={MR}>{mr}</span></span>
                      <NumCell value={slip[k]} conf={slip.conf[k]} edited={edited.has(k)} label={en} onChange={(v) => setNum(k, v)} />
                    </label>
                  ))}
                </div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="label-form text-[10px] text-ink-3">
                      <th className="px-2 pb-0.5 pt-1.5 text-left font-normal">Line</th>
                      <th className="w-[96px] px-1 pb-0.5 pt-1.5 text-right font-normal">On slip</th>
                      <th className="w-[76px] px-2 pb-0.5 pt-1.5 text-right font-normal">Should be</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-ink/15">
                      <td className="px-2 font-semibold">Gross <span className="font-normal text-ink-2" style={MR}>एकूण</span></td>
                      <td className="px-1"><NumCell value={slip.gross} conf={slip.conf.gross} edited={edited.has("gross")} label="Gross amount" onChange={(v) => setNum("gross", v)} className="font-bold" /></td>
                      <td className="typed px-2 text-right text-[12px] text-ink-3">{slip.kg && slip.rate ? Math.round(slip.kg * slip.rate).toLocaleString("en-IN") : "·"}</td>
                    </tr>
                    {slip.charges.map((c, i) => {
                      const k = checks.find((x) => x.charge === i);
                      const bad = k?.tone === "flag";
                      return (
                        <tr key={i} className={cn("border-t border-ink/15", bad && "bg-alert/[0.06]")}>
                          <td className={cn("px-2 py-0.5 leading-tight", bad && "text-alert")}>
                            <span className="block">{c.label}</span>
                            <span className="block text-[12px] opacity-80" style={MR}>{KIND_MR[c.kind]}</span>
                          </td>
                          <td className={cn("px-1", bad && "[&_input]:text-alert")}><NumCell value={c.unread ? undefined : c.amount} conf={c.unread ? 0 : c.conf} edited={edited.has(`c${i}`)} label={c.label} onChange={(v) => setCharge(i, v)} corrected={c.repaired !== undefined ? `Read as ${c.repaired.toLocaleString("en-IN")}; corrected by the line's own arithmetic. Check it on the slip.` : undefined} /></td>
                          <td className="typed px-2 text-right text-[12px] text-ink-3">{k?.card === undefined ? "·" : k.card === 0 ? "none" : k.card.toLocaleString("en-IN")}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-ink/30">
                      <td className="px-2">Total deductions <span className="text-ink-2" style={MR}>एकूण कपात</span></td>
                      <td className="px-1"><NumCell value={slip.total} conf={slip.conf.total} edited={edited.has("total")} label="Total deductions" onChange={(v) => setNum("total", v)} /></td>
                      <td className="typed px-2 text-right text-[12px] text-ink-3">{checks.some((c) => c.card !== undefined) ? checks.reduce((a, c) => a + (c.card ?? 0), 0).toLocaleString("en-IN") : "·"}</td>
                    </tr>
                    <tr className="border-t-2 border-ink">
                      <td className="px-2 font-bold text-stamp">Net to you <span className="font-normal" style={MR}>निव्वळ</span></td>
                      <td className="px-1"><NumCell value={slip.net} conf={slip.conf.net} edited={edited.has("net")} label="Net payable" onChange={(v) => setNum("net", v)} className="font-bold text-stamp" /></td>
                      <td className="typed px-2 text-right text-[12px] text-ink-3">{slip.gross !== undefined && checks.some((c) => c.card !== undefined) ? (slip.gross - checks.reduce((a, c) => a + (c.card ?? 0), 0)).toLocaleString("en-IN") : "·"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
                <span><span className="typed text-ink">Typed</span> read from the photo</span>
                <span><span className="ballpoint text-[13px]">Ballpoint</span> corrected by you</span>
                <span><span className="underline decoration-alert decoration-dotted decoration-2 underline-offset-2">Dotted</span> check this number</span>
              </p>

              <ul className="mt-3 space-y-1.5">
                {checks.map((c) => (
                  <li key={c.id} className="flex gap-2 text-[13.5px] leading-snug">
                    <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center", c.tone === "flag" ? "text-alert" : c.tone === "ok" ? "text-stamp" : "text-ink-3")} aria-hidden>
                      {c.tone === "flag" ? <span className="text-[15px] font-bold leading-none">!</span> : c.tone === "ok" ? <Tick className="size-4" /> : <span className="text-[15px] leading-none">·</span>}
                    </span>
                    <span className={cn(c.tone === "flag" && "font-semibold text-alert", c.tone === "info" && "text-ink-2")}>
                      {c.en}
                      {c.id === "rate" && <span className="typed ml-1 text-[11px] font-normal text-ink-3">(simulated mandi price)</span>}
                      <span className="block font-normal text-ink-2" style={MR}>{c.mr}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {slip.skipped.length > 0 && (
                <details className="mt-2 text-[12px] text-ink-3">
                  <summary className="cursor-pointer">{slip.skipped.length} lines not used (Marathi headings, notes)</summary>
                  <ul className="typed mt-1 space-y-0.5">{slip.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </details>
              )}

              <div className="mt-4 space-y-2.5">
                {filed ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-y border-ink/20 py-2">
                    <Stamp tone="stamp" size="sm" rotate={-3}>Filed {fmtDay(filed.day)}</Stamp>
                    {filed.day > day ? (
                      <button type="button" onClick={() => setDay(filed.day)} className="min-h-11 rounded-[2px] border-2 border-ink px-3 text-[13.5px] font-semibold">
                        Go to {fmtDay(filed.day)} <span className="font-normal" style={MR}>{mrDay(filed.day)} वर जा</span>
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-ink-2">Now in your record and on the desk. <span style={MR}>नोंदीत आणि डेस्कवर.</span></span>
                    )}
                  </div>
                ) : (
                  <StampButton tone="stamp" disabled={!sale} onClick={() => { if (sale) { fileSlip(sale); setFiled(sale); } }} className="min-h-14 w-full">
                    <span className="text-[16px] font-bold">File in my record</span>
                    <span className="text-[15px]" style={MR}>नोंदीत जतन करा</span>
                  </StampButton>
                )}
                {filed && filed.day > day && <p className="text-[12px] leading-snug text-ink-3">The slip is dated after today&apos;s date in the demo, so the record shows it from {fmtDay(filed.day)}.</p>}
                {extra > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={sent} onClick={sendToOfficer} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] bg-ink px-2 text-[14px] font-bold leading-tight text-paper disabled:bg-paper-3 disabled:text-ink-3">
                      <Send className="size-4 shrink-0" />
                      <span className="text-left">{sent ? "Sent to the officer" : "Send to the officer"}<span className="block text-[13px] font-normal" style={MR}>{sent ? "उत्तर ‘प्रश्न’मध्ये येईल" : "अधिकाऱ्याला पाठवा"}</span></span>
                    </button>
                    <button type="button" onClick={share} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border-2 border-ink px-2 text-[14px] font-bold leading-tight">
                      <Share2 className="size-4 shrink-0" />
                      <span className="text-left">{shared === "copied" ? "Note copied" : shared === "shared" ? "Note shared" : "Note for the agent"}<span className="block text-[13px] font-normal" style={MR}>अडत्यासाठी नोंद</span></span>
                    </button>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
