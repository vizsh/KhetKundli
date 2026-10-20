"use client";

import Counter from "@/components/Counter";
import { Sheet, SheetHead } from "@/components/record/sheet";
import { SourceStamp } from "@/components/record/stamp";
import { geo } from "@/lib/geo";
import { fmtDay, weekOf, weekStart } from "@/lib/sim/calendar";
import { focusWeek, recentDetections, riskCounts, weekTotals } from "@/lib/sim/selectors";
import { useState } from "react";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";
import { WaveChart } from "./wave-chart";

function Poster({ value, decimals = 0, unit, caption, tight = false }: { value: number; decimals?: number; unit?: string; caption: React.ReactNode; tight?: boolean }) {
  return (
    <div className={cn("flex items-end gap-4 px-4", tight ? "pt-1" : "pt-3")}>
      <p className="flex items-baseline leading-[0.82] text-ink">
        <Counter value={value} decimals={decimals} fontSize={92} fontWeight={700} intro={false} duration={0.55} bounce={0.12} motionBlur={false} fade={0.12} style={{ fontStretch: "75%", letterSpacing: "-0.03em" }} />
        {unit ? <span className="ml-1 text-[30px] font-semibold [font-stretch:80%]">{unit}</span> : null}
      </p>
      <div className="min-w-0 pb-2 text-[13.5px] leading-snug text-ink-2">{caption}</div>
    </div>
  );
}

function RiskKey() {
  const items = [
    { level: 1, label: "Watch" },
    { level: 2, label: "Warning" },
    { level: 3, label: "Outbreak" },
  ];
  return (
    <div className="flex items-center gap-4 px-4 pb-3 pt-2 text-[11.5px] text-ink-2">
      {items.map((it) => (
        <span key={it.level} className="flex items-center gap-1.5">
          <svg width="18" height="14" aria-hidden>
            <path d="M4.5 0.5 L13.5 0.5 L17.5 7 L13.5 13.5 L4.5 13.5 L0.5 7 Z" fill={`url(#risk-${it.level})`} stroke="var(--ink)" strokeOpacity={0.5} />
          </svg>
          {it.label}
        </span>
      ))}
      <span className="ml-auto typed text-[10.5px] text-ink-3">H3 res 7, ~5 km² cells</span>
    </div>
  );
}

/**
 * Leaf-wet hours, every day of the season: the weather that lets bacterial blight move. Solid ink is
 * recorded (Open-Meteo archive), violet is the live forecast, pale is simulated beyond it.
 */
function BlightWeather() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const [hover, setHover] = useState<number | null>(null);
  const W = 490, H = 26, n = season.weather.length, bw = W / n;
  const wet = (d: number) => season.weather[d].wetHours ?? Math.max(0, Math.min(24, (season.weather[d].rh - 62) * 0.7 + (season.weather[d].rainMm > 2 ? 4 : 0)));
  const shown = hover ?? Math.floor(t);
  const w = season.weather[shown];
  const recorded = season.recordedThrough;
  const total = season.weather.slice(0, recorded + 1).reduce((a, x) => a + x.rainMm, 0);
  return (
    <div className="px-4 pb-1 pt-2">
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="font-semibold text-ink-2">Leaf-wet hours a day <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>पाने ओली राहिलेले तास</span></span>
        <span className="typed truncate text-[10.5px] text-ink-3">
          {hover === null && recorded >= 0 ? (
            <>recorded to {fmtDay(recorded)} · {Math.round(total)} mm since 1 JUN · <span className="font-bold text-alert">red</span> 12 h+</>
          ) : (
            <>
              {fmtDay(shown)} · {Math.round(wet(shown))} h wet · {w.rainMm.toFixed(0)} mm{" "}
              <span className={cn("font-bold", w.observed ? "text-ink" : w.live ? "text-stamp" : "text-ink-3")}>{w.observed ? "recorded" : w.live ? "forecast" : "simulated"}</span>
            </>
          )}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 h-[26px] w-full cursor-crosshair" onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)))); }}
        role="img" aria-label={`Leaf-wet hours a day this season; ${recorded >= 0 ? `recorded to ${fmtDay(recorded)}, ${Math.round(total)} mm of rain so far` : "simulated"}`}>
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--ink)" strokeOpacity={0.35} />
        {season.weather.map((x, d) => {
          const h = (wet(d) / 24) * (H - 3);
          if (h < 0.5) return null;
          const fill = x.observed ? (wet(d) >= 12 ? "var(--alert)" : "var(--ink)") : x.live ? "var(--stamp)" : "var(--ink-3)";
          return <rect key={d} x={d * bw} y={H - 1 - h} width={Math.max(0.6, bw - 0.5)} height={h} fill={fill} opacity={x.observed || x.live ? 0.85 : 0.3} />;
        })}
        <line x1={(Math.floor(t) + 0.5) * bw} x2={(Math.floor(t) + 0.5) * bw} y1={0} y2={H} stroke="var(--stamp)" strokeWidth={1.6} />
        {hover !== null && <rect x={hover * bw - 0.5} y={0} width={bw + 1} height={H} fill="var(--stamp)" opacity={0.18} />}
      </svg>
    </div>
  );
}

export function FigureSheet() {
  const layer = useDesk((s) => s.layer);
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const waveWeek = useDesk((s) => s.waveWeek);
  const day = Math.floor(t);

  if (layer === "pest") {
    const [, watch, warn, out] = riskCounts(season, day);
    const reported = recentDetections(season, day);
    return (
      <Sheet>
        <SheetHead form="KK-3" title="Bacterial blight across the taluka" mr="तेल्या रोग" right={<SourceStamp live={false} label="Built from scans reported in the simulated network" />} />
        <BlightWeather />
        <Poster
          tight
          value={warn + out}
          caption={
            <>
              {warn + out === 1 ? "hex" : "hexes"} on <span className="font-semibold text-alert">warning or outbreak</span>
              <br />
              {watch} more on watch · {reported} {reported === 1 ? "scan" : "scans"} reported in 14 days
            </>
          }
        />
        <RiskKey />
      </Sheet>
    );
  }

  if (layer === "wave") {
    const totals = weekTotals(season);
    const week = focusWeek(season, day, waveWeek);
    const peak = totals.reduce((best, v, i) => (v > totals[best] ? i : best), 0);
    const following = week === weekOf(day);
    return (
      <Sheet>
        <SheetHead form="KK-5" title="Expected pickings, from crop stage on every plot" mr="तोडणी लाट" right={<SourceStamp live={false} />} />
        <Poster
          value={totals[week] ?? 0}
          caption={
            <>
              {(totals[week] ?? 0) === 1 ? "crate" : "crates"} expected in the week of {fmtDay(weekStart(week))}
              {week === peak ? " (peak)" : ""}
              <br />
              {following ? `Peak week: ${fmtDay(weekStart(peak))}, ${totals[peak].toLocaleString("en-IN")} crates` : "Hover a week in the chart to read it on the map"}
            </>
          }
        />
        <div className="px-3 pb-3 pt-1">
          <WaveChart />
        </div>
      </Sheet>
    );
  }

  if (layer === "water") {
    const saved = season.waterSavedByDay[day] / 1e6;
    const share = season.forecastIrrigationShare[day];
    return (
      <Sheet>
        <SheetHead form="KK-6" title="Groundwater kept in the ground" mr="पाण्याचा सामायिक साठा" right={<SourceStamp live={false} />} />
        <Poster
          value={saved}
          decimals={1}
          unit="ML"
          caption={
            <>
              saved this season by skipping irrigation
              <br />
              before forecast rain
            </>
          }
        />
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="text-ink-2">Plots following forecast irrigation, last 3 weeks</span>
            <span className="typed font-bold">{Math.round(share * 100)}%</span>
          </div>
          <div className="relative mt-1.5 h-3 rounded-[1px] bg-paper-3">
            <div className="absolute inset-y-0 left-0 bg-[#5a9752] transition-[width] duration-200" style={{ width: `${Math.round(share * 100)}%` }} />
            <div className="absolute inset-y-[-4px] w-0.5 bg-ink" style={{ left: "80%" }} />
          </div>
          <p className="mt-1 text-right text-[11px] text-ink-3">Village goal: 80% of plots</p>
        </div>
      </Sheet>
    );
  }

  const runs = season.runsByDay[day] ?? [];
  const crates = runs.reduce((a, r) => a + r.crates, 0);
  return (
    <Sheet>
      <SheetHead form="KK-7" title="Scheduled runs from village collection points" mr="सामायिक वाहतूक" right={<SourceStamp live={false} />} />
      <Poster
        value={runs.length}
        caption={
          runs.length ? (
            <>
              pooled {runs.length === 1 ? "run" : "runs"} today, {crates.toLocaleString("en-IN")} crates
              <br />
              {Math.round((crates / Math.max(1, runs.length * 75)) * 100)}% average fill, departing 05:15
            </>
          ) : (
            <>
              no runs today
              <br />
              first pickings are due in the week of {fmtDay(weekStart(weekOf(Math.min(...season.plots.map((p) => p.harvestStart)))))}
            </>
          )
        }
      />
      {runs.length ? (
        <ol className="max-h-40 overflow-y-auto px-4 pb-3 pt-2 text-[12.5px]">
          {runs.slice(0, 24).map((r) => (
            <li key={r.id} className="grid grid-cols-[6.5rem_1fr_auto] gap-2 border-b border-dotted border-ink/25 py-1">
              <span className="typed text-[11.5px]">{r.id}</span>
              <span className="truncate">{geo.villages.find((v) => v.id === r.hub)?.name} → {r.km > 60 ? (r.km > 300 ? "Vashi" : "Pune") : "Phaltan APMC"}</span>
              <span className="typed text-[11.5px]">{r.crates}/{r.capacity}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Sheet>
  );
}
