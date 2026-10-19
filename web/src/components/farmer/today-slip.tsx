"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { SourceStamp } from "@/components/record/stamp";
import { bestWindow, sprayRibbon, todayAction } from "@/lib/farmer";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

// Good hours in leaf green, fair in turmeric, bad hours hatched in red ink like the desk's blight radar.
const OK_FILL = {
  good: "#5a9752",
  fair: "#e2c46a",
  bad: "repeating-linear-gradient(135deg, var(--paper) 0 3px, var(--alert) 3px 4.5px)",
} as const;

export function SprayRibbon() {
  const season = useDesk((s) => s.season);
  const hourly = useDesk((s) => s.hourly);
  const t = useDesk((s) => s.t);
  const today = useDesk((s) => s.today);
  const day = Math.floor(t);
  const { cells, live } = useMemo(() => sprayRibbon(season.weather, day, hourly, day === today), [season.weather, day, hourly, today]);
  const best = bestWindow(cells);
  if (!cells.length) return null;
  const W = 100 / cells.length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-ink-2">
          Spray window, next 72 hours <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>फवारणीची वेळ</span>
        </p>
        <SourceStamp live={live} label={live ? "Open-Meteo hourly forecast" : "From the simulated season weather"} />
      </div>
      <div className="relative mt-1.5 h-7 overflow-hidden rounded-[2px] border border-ink/40" role="img" aria-label={best ? `Best spray window starts ${cells[best.start].label}` : "No good spray window in 72 hours"}>
        {cells.map((c, i) => (
          <span
            key={i}
            className="absolute inset-y-0"
            style={{ left: `${i * W}%`, width: `${W + 0.05}%`, background: OK_FILL[c.ok], opacity: c.ok === "bad" ? 0.75 : 0.9 }}
            title={`${c.label}: rain ${Math.round(c.rainProb * 100)}%, wind ${c.windKmh} km/h, ${Math.round(c.tempC)}°C`}
          />
        ))}
        {cells.map((c, i) => (c.hour === 0 && i > 0 ? <span key={`m${i}`} className="absolute inset-y-0 w-px bg-ink" style={{ left: `${i * W}%` }} /> : null))}
        {best && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-y-0 rounded-[2px] border-[2.5px] border-stamp"
            style={{ left: `${best.start * W}%`, width: `${(best.end - best.start + 1) * W}%` }}
          />
        )}
      </div>
      <p className="mt-1 flex items-baseline justify-between gap-2 text-[11.5px] text-ink-3">
        <span>now · आता</span>
        <span className="text-center">{best ? <>best <span style={{ fontFamily: "var(--font-anek-deva)" }}>उत्तम</span>: <span className="typed font-bold text-stamp">{cells[best.start].label}</span></> : <>no dry, calm morning yet <span style={{ fontFamily: "var(--font-anek-deva)" }}>कोरडी सकाळ नाही</span></>}</span>
        <span>+72 h</span>
      </p>
    </div>
  );
}

export function TodaySlip({ plot }: { plot: number }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const day = Math.floor(t);
  const action = todayAction(season, plot, day);
  return (
    <motion.section
      key={`${day}-${action.kind}`}
      initial={{ y: 8, opacity: 0.4 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="perforated relative bg-slip px-4 pb-4 pt-5 shadow-[var(--shadow-sheet)]"
      aria-live="polite"
    >
      <span className="typed absolute right-3 top-3 text-[10.5px] text-ink-3">KK-1 · today</span>
      <p className={cn("pr-16 text-[22px] font-bold leading-tight [font-stretch:88%]", action.tone === "alert" && "text-alert")}>{action.en}</p>
      <p className="mt-0.5 text-[19px] leading-snug" style={{ fontFamily: "var(--font-tiro-marathi), var(--font-anek-deva)" }}>{action.mr}</p>
      {action.detail ? <p className="typed mt-2 text-[13px] leading-snug text-ink">{action.detail}</p> : null}
      {action.detailMr ? <p className="mt-0.5 text-[14px] leading-snug text-ink-2" style={{ fontFamily: "var(--font-anek-deva)" }}>{action.detailMr}</p> : null}
      <div className="mt-3">
        <SprayRibbon />
      </div>
    </motion.section>
  );
}
