"use client";

import { useMemo, useState } from "react";
import { fmtDay, weekStart } from "@/lib/sim/calendar";
import { focusWeek, weekTotals } from "@/lib/sim/selectors";
import { useDesk } from "@/lib/store";

const FIRST_WEEK = 20; // 19 Oct
const LAST_WEEK = 34; // late Jan
const W = 520, BAR_H = 92, PRICE_H = 78, GAP = 22, L = 48, R = 58, T = 14;
const PH = "#b84a5e";
const PU = "#2c68a8";

export function WaveChart() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const setDay = useDesk((s) => s.setDay);
  const setWaveWeek = useDesk((s) => s.setWaveWeek);
  const pinned = useDesk((s) => s.waveWeek);
  const week = focusWeek(season, Math.floor(t), pinned);
  const [hover, setHover] = useState<number | null>(null);

  const data = useMemo(() => {
    const totals = weekTotals(season);
    const weeks = [];
    for (let w = FIRST_WEEK; w <= LAST_WEEK; w++) {
      const days = Array.from({ length: 7 }, (_, i) => weekStart(w) + i).filter((d) => d < season.prices.phaltan.length);
      const avg = (arr: number[]) => Math.round(days.reduce((a, d) => a + arr[d], 0) / Math.max(1, days.length));
      weeks.push({ w, crates: totals[w] ?? 0, ph: avg(season.prices.phaltan), pu: avg(season.prices.pune) });
    }
    return weeks;
  }, [season]);

  const n = data.length;
  const bw = (W - L - R) / n;
  const x = (i: number) => L + i * bw;
  const maxC = Math.max(...data.map((d) => d.crates), 1);
  const yC = (c: number) => T + BAR_H - (c / maxC) * BAR_H;
  const prices = data.flatMap((d) => [d.ph, d.pu]);
  const pMin = Math.floor(Math.min(...prices) / 10) * 10 - 5, pMax = Math.ceil(Math.max(...prices) / 10) * 10;
  const top2 = T + BAR_H + GAP;
  const yP = (p: number) => top2 + PRICE_H - ((p - pMin) / (pMax - pMin)) * PRICE_H;
  const line = (key: "ph" | "pu") => data.map((d, i) => `${i ? "L" : "M"}${(x(i) + bw / 2).toFixed(1)},${yP(d[key]).toFixed(1)}`).join("");
  const glut = data.reduce((best, d, i) => (d.pu - d.ph < data[best].pu - data[best].ph ? i : best), 0);
  const H = top2 + PRICE_H + 26;
  const hv = hover !== null ? data[hover] : null;
  const last = data[n - 1];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Expected harvest crates per week and mandi prices">
        {/* gridlines, recessive */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={yC(maxC * f)} y2={yC(maxC * f)} stroke="var(--ink)" strokeOpacity={0.12} />
            <text x={L - 6} y={yC(maxC * f) + 3} textAnchor="end" fontSize={9.5} fill="var(--ink-3)" className="typed">{Math.round((maxC * f) / 1000)}k</text>
          </g>
        ))}
        {[pMin + 5, Math.round((pMin + pMax) / 2), pMax].map((p) => (
          <g key={p}>
            <line x1={L} x2={W - R} y1={yP(p)} y2={yP(p)} stroke="var(--ink)" strokeOpacity={0.12} />
            <text x={L - 6} y={yP(p) + 3} textAnchor="end" fontSize={9.5} fill="var(--ink-3)" className="typed">₹{p}</text>
          </g>
        ))}
        {/* glut band across both panels */}
        <rect x={x(glut)} y={T - 6} width={bw} height={top2 + PRICE_H - T + 6} fill="var(--alert)" opacity={0.07} />
        <text x={x(glut) + bw / 2} y={T - 4} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--alert)">PUNE GLUT</text>
        {/* bars */}
        {data.map((d, i) => (
          <rect
            key={d.w}
            x={x(i) + 1}
            y={yC(d.crates)}
            width={bw - 2}
            height={Math.max(0, T + BAR_H - yC(d.crates))}
            rx={1.5}
            fill={d.w === week ? "var(--wave-4)" : "var(--wave-3)"}
            opacity={d.w === week ? 1 : 0.72}
          />
        ))}
        <line x1={L} x2={W - R} y1={T + BAR_H} y2={T + BAR_H} stroke="var(--ink)" strokeWidth={1} />
        {data.some((d) => d.w === week) && (() => {
          const i = data.findIndex((d) => d.w === week);
          return (
            <text x={x(i) + bw / 2} y={yC(data[i].crates) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--ink)" className="typed">
              {data[i].crates.toLocaleString("en-IN")}
            </text>
          );
        })()}
        <text x={W - R + 6} y={T + 8} fontSize={10} fill="var(--ink-2)">crates</text>
        <text x={W - R + 6} y={T + 20} fontSize={10} fill="var(--ink-2)">per week</text>
        {/* prices */}
        <path d={line("ph")} fill="none" stroke={PH} strokeWidth={2} strokeLinejoin="round" />
        <path d={line("pu")} fill="none" stroke={PU} strokeWidth={2} strokeLinejoin="round" />
        <text x={x(n - 1) + bw / 2 + 6} y={yP(last.ph) + 4} fontSize={10} fontWeight={600} fill="var(--ink)">Phaltan</text>
        <text x={x(n - 1) + bw / 2 + 6} y={yP(last.pu) + 4} fontSize={10} fontWeight={600} fill="var(--ink)">Pune</text>
        <line x1={L} x2={W - R} y1={top2 + PRICE_H} y2={top2 + PRICE_H} stroke="var(--ink)" strokeWidth={1} />
        {data.map((d, i) =>
          i % 2 === 0 ? (
            <text key={d.w} x={x(i) + bw / 2} y={top2 + PRICE_H + 13} textAnchor="middle" fontSize={9} fill="var(--ink-3)" className="typed">
              {fmtDay(weekStart(d.w)).replace(" ", " ")}
            </text>
          ) : null,
        )}
        {/* hover layer: one hit column per week */}
        {hv && <line x1={x(hover!) + bw / 2} x2={x(hover!) + bw / 2} y1={T} y2={top2 + PRICE_H} stroke="var(--ink)" strokeOpacity={0.4} />}
        {hv && (
          <>
            <circle cx={x(hover!) + bw / 2} cy={yP(hv.ph)} r={4} fill={PH} stroke="var(--paper)" strokeWidth={2} />
            <circle cx={x(hover!) + bw / 2} cy={yP(hv.pu)} r={4} fill={PU} stroke="var(--paper)" strokeWidth={2} />
          </>
        )}
        {data.map((d, i) => (
          <rect
            key={`hit${d.w}`}
            x={x(i)}
            y={T - 8}
            width={bw}
            height={top2 + PRICE_H - T + 20}
            fill="transparent"
            className="cursor-pointer"
            onPointerEnter={() => { setHover(i); setWaveWeek(d.w); }}
            onPointerLeave={() => { setHover(null); setWaveWeek(null); }}
            onClick={() => { setWaveWeek(null); setDay(weekStart(d.w)); }}
          />
        ))}
      </svg>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: PH }} /> Phaltan APMC, ₹/kg grade A</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: PU }} /> Pune market yard</span>
      </div>
      {hv && (
        <div
          className="pointer-events-none absolute top-2 rounded-[2px] bg-paper px-2.5 py-1.5 text-[11.5px] shadow-[var(--shadow-lift)]"
          style={{ left: `${Math.min(70, ((x(hover!) + bw) / W) * 100)}%` }}
        >
          <p className="typed text-[10.5px] text-ink-3">WEEK OF {fmtDay(weekStart(hv.w))}</p>
          <p><span className="font-semibold tabular">{hv.crates.toLocaleString("en-IN")}</span> crates expected</p>
          <p className="tabular">Phaltan ₹{hv.ph} · Pune ₹{hv.pu}</p>
        </div>
      )}
    </div>
  );
}
