"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Download, Loader2, Share2, X } from "lucide-react";
import { geo } from "@/lib/geo";
import { lotId, passportFor } from "@/lib/lot";
import { renderShareCard } from "@/lib/share-card";
import { dateOf, fmtDay, MONTHS } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;

/** "Share my season": the kundli wheel and the season so far, as one image for WhatsApp or print. */
export function ShareCard({ plot }: { plot: number }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The dialog portals to the body, which exists only in the browser.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const make = async () => {
    const svg = document.querySelector<SVGSVGElement>("svg[aria-label^='Season wheel']");
    if (!svg) return;
    setBusy(true);
    setError(null);
    try {
      const day = Math.floor(t);
      const p = season.plots[plot];
      const ev = season.eventsByPlot[plot].filter((e) => e.day <= day);
      const sprays = ev.filter((e) => e.type === "spray");
      const washed = sprays.filter((e) => e.type === "spray" && e.washedOff).length;
      const scans = ev.filter((e) => e.type === "scan").length;
      const water = ev.reduce((a, e) => a + (e.type === "irrigate" ? e.litres : 0), 0) / 1000;
      const saved = ev.reduce((a, e) => a + (e.type === "irrigate-skip" ? e.litresSaved : 0), 0) / 1000;
      const rain = season.weather.slice(0, day + 1).reduce((a, w) => a + w.rainMm, 0);
      const pick = season.eventsByPlot[plot].find((e) => e.type === "pick");
      const lot = pick && pick.type === "pick" ? passportFor(season, lotId(p.id, pick.picking)) : null;
      const { d, m, y } = dateOf(day);
      const blob = await renderShareCard(svg, {
        name: p.farmer.name,
        nameMr: p.farmer.mr,
        place: `Gat ${p.gat} · ${geo.villages[p.village].name} · ${p.acres} ac · Mrig bahar ${y}`,
        date: `${String(d).padStart(2, "0")} ${MONTHS[m]} ${y}`,
        lines: [
          { label: season.recordedThrough >= 0 ? "Rain so far (recorded)" : "Rain so far", value: `${Math.round(rain)} mm` },
          { label: "Sprays", value: `${sprays.length}${washed ? ` (${washed} washed off)` : ""}` },
          { label: "Leaf scans", value: `${scans}` },
          { label: "Water by drip", value: `${Math.round(water).toLocaleString("en-IN")} kL · ${Math.round(saved)} kL saved` },
          { label: "First picking", value: pick && pick.type === "pick" ? `${fmtDay(pick.day)} · ${pick.crates} crates` : "Not planned" },
          { label: "Export check", value: lot ? (lot.exportCheck.eligible ? "Copper interval clear" : `Domestic (spray ${lot.exportCheck.blocking!.gap} d before)`) : "-" },
        ],
        note: "Synthetic plot, Phaltan Hackathon demo",
      });
      const file = new File([blob], `kundli-${p.id}.png`, { type: "image/png" });
      setCard({ url: URL.createObjectURL(blob), file });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!card) return;
    try {
      if (navigator.canShare?.({ files: [card.file] })) await navigator.share({ files: [card.file], title: "My season" });
      else {
        const a = document.createElement("a");
        a.href = card.url;
        a.download = card.file.name;
        a.click();
      }
    } catch { /* closed the share sheet */ }
  };

  return (
    <>
      <button type="button" onClick={make} disabled={busy} className="mx-auto mt-2 flex min-h-11 items-center gap-1.5 rounded-[3px] border-2 border-ink/40 px-3 text-[13px] font-semibold hover:border-ink disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />} Share my season <span className="font-normal" style={MR}>माझा हंगाम पाठवा</span>
      </button>
      {error && <p className="mt-1 text-center text-[12px] text-alert">Could not make the card: {error}</p>}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {card && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-ink/60 px-4" role="dialog" aria-modal="true" aria-label="Your season card" onClick={() => setCard(null)}>
                <motion.div initial={{ y: 16 }} animate={{ y: 0 }} className="w-full max-w-[380px] rounded-[3px] bg-paper p-3 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-1 pb-2">
                    <p className="text-[15px] font-semibold">Your season card <span className="font-normal text-ink-2" style={MR}>हंगामाचे कार्ड</span></p>
                    <button type="button" onClick={() => setCard(null)} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-ink/10"><X className="size-5" /></button>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.url} alt="Season card: the kundli wheel and the season so far" className="w-full border border-ink/20" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={share} className="flex min-h-12 items-center justify-center gap-1.5 rounded-[3px] bg-ink text-[14px] font-bold text-paper"><Share2 className="size-4" /> Share</button>
                    <a href={card.url} download={card.file.name} className="flex min-h-12 items-center justify-center gap-1.5 rounded-[3px] border-2 border-ink text-[14px] font-bold"><Download className="size-4" /> Save</a>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
