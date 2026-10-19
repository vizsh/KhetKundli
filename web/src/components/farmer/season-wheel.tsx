"use client";

import { memo, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { dateOf, MONTHS, SEASON_DAYS } from "@/lib/sim/calendar";
import { mrDay, mrNum } from "@/lib/farmer";
import { STAGE_LABEL, stageOn } from "@/lib/sim/rules";
import type { PlotEvent, Season, Stage } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";

const S = 380;
const C = S / 2;
const R = { outer: 188, rimIn: 154, stageOut: 150, stageIn: 137, rain: 125, water: 114, spray: 102, pick: 88, core: 74 };
const STAGE_FILL: Record<Stage, string> = {
  rest: "var(--paper-3)",
  bahar: "#e2d3a6",
  flowering: "#e9c9a2",
  fruitset: "#c6dbab",
  development: "#9cc283",
  maturity: "#dc9a98",
  harvest: "#b84a5e",
  done: "var(--paper-3)",
};
const MONTH_START = [0, 30, 61, 92, 122, 153, 183, 214];
const MONTH_EN = ["JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN"];
const MONTH_MR = ["जून", "जुलै", "ऑगस्ट", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें", "जाने"];

const ang = (day: number) => (day / SEASON_DAYS) * Math.PI * 2 - Math.PI / 2;
// Rounded to 0.1 so server and browser render identical markup.
const rnd = (n: number) => Math.round(n * 10) / 10;
const pt = (r: number, a: number) => [rnd(C + r * Math.cos(a)), rnd(C + r * Math.sin(a))] as const;

function arc(r0: number, r1: number, d0: number, d1: number) {
  const a0 = ang(d0), a1 = ang(d1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/** Stage band and ruling: continuous, so past and future are split by a mask at today. */
const StageBand = memo(function StageBand({ season, plot }: { season: Season; plot: number }) {
  const p = season.plots[plot];
  const lastPick = p.harvestStart + 25;
  const stages = useMemo(() => {
    const out: { stage: Stage; from: number; to: number }[] = [];
    for (let d = 0; d < SEASON_DAYS; d++) {
      const st = stageOn(d, p.baharStart, p.harvestStart, lastPick);
      const last = out.at(-1);
      if (last && last.stage === st) last.to = d + 1;
      else out.push({ stage: st, from: d, to: d + 1 });
    }
    return out;
  }, [p.baharStart, p.harvestStart, lastPick]);
  return (
    <g>
      {[R.rimIn, R.stageIn, R.rain, R.water, R.spray, R.pick].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="var(--rule)" strokeWidth={0.7} opacity={0.75} />
      ))}
      {stages.map((s) => (
        <path key={s.from} d={arc(R.stageIn, R.stageOut, s.from, s.to)} fill={STAGE_FILL[s.stage]} stroke="var(--paper)" strokeWidth={1} />
      ))}
    </g>
  );
});

/** Every mark knows its day; marks after today turn to pencil with a 200 ms fade as the pointer moves. */
const Marks = memo(function Marks({ season, plot, today }: { season: Season; plot: number; today: number }) {
  const events = season.eventsByPlot[plot];
  const fade = (day: number): React.CSSProperties => ({
    opacity: day > today ? 0.4 : 1,
    filter: day > today ? "grayscale(1)" : "none",
    transition: "opacity 200ms ease-out, filter 200ms ease-out",
  });
  const of = <T extends PlotEvent["type"]>(t: T) => events.filter((e): e is Extract<PlotEvent, { type: T }> => e.type === t);
  return (
    <g>
      {season.weather.map((w) => {
        if (w.rainMm < 1) return null;
        const a = ang(w.day + 0.5);
        const [x1, y1] = pt(R.rain - 5, a), [x2, y2] = pt(R.rain - 5 + Math.min(14, 2 + w.rainMm * 0.8), a);
        return <line key={w.day} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--water)" strokeWidth={1.4} style={fade(w.day)} />;
      })}
      {[...of("irrigate"), ...of("irrigate-skip")].map((e) => {
        const [x, y] = pt(R.water, ang(e.day + 0.5));
        return e.type === "irrigate" ? (
          <circle key={e.id} cx={x} cy={y} r={1.5} fill="var(--ink)" style={fade(e.day)} />
        ) : (
          <circle key={e.id} cx={x} cy={y} r={2.6} fill="var(--paper)" stroke="var(--water)" strokeWidth={1.3} style={fade(e.day)} />
        );
      })}
      {of("spray").map((e) => {
        const [x, y] = pt(R.spray, ang(e.day + 0.5));
        return (
          <g key={e.id} transform={`translate(${x},${y})`} style={fade(e.day)}>
            <rect x={-3.6} y={-3.6} width={7.2} height={7.2} transform="rotate(45)" fill={e.washedOff ? "var(--alert)" : "var(--stamp)"} stroke="var(--paper)" strokeWidth={1} />
            {e.washedOff && <line x1={-5} y1={5} x2={5} y2={-5} stroke="var(--alert)" strokeWidth={1.6} />}
          </g>
        );
      })}
      {of("scan").map((e) => {
        const [x, y] = pt(R.spray - 9, ang(e.day + 0.5));
        return (
          <g key={e.id} transform={`translate(${x},${y})`} stroke={e.finding !== "healthy" ? "var(--alert)" : "var(--ink)"} strokeWidth={2} strokeLinecap="round" style={fade(e.day)}>
            <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} />
            <line x1={-3.5} y1={3.5} x2={3.5} y2={-3.5} />
          </g>
        );
      })}
      {of("pick").map((e) => {
        // A crate tally: one stroke per ~25 crates, the fifth drawn across the other four.
        const strokes = Math.max(1, Math.min(5, Math.round(e.crates / 25)));
        const lines = [];
        for (let k = 0; k < Math.min(strokes, 4); k++) {
          const a = ang(e.day + 0.5 + (k - 1.5) * 0.9);
          const [x1, y1] = pt(R.pick + 4, a), [x2, y2] = pt(R.pick - 8, a);
          lines.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />);
        }
        if (strokes === 5) {
          const [x1, y1] = pt(R.pick - 8, ang(e.day + 0.5 - 2.2)), [x2, y2] = pt(R.pick + 4, ang(e.day + 0.5 + 2.2));
          lines.push(<line key="slash" x1={x1} y1={y1} x2={x2} y2={y2} />);
        }
        return (
          <g key={e.id} stroke="var(--wave-4)" strokeWidth={2} strokeLinecap="round" style={fade(e.day)}>
            {lines}
          </g>
        );
      })}
    </g>
  );
});

/** Month rim: drawn above the masks so future months stay fully legible. */
const MonthRim = memo(function MonthRim() {
  return (
    <g>
      {MONTH_START.map((d, i) => {
        const a = ang(d);
        const [x0, y0] = pt(R.stageIn - 2, a), [x1, y1] = pt(R.outer, a);
        // Upright, two lines (English over Marathi) in the middle of the rim band, haloed in paper.
        const [lx, ly] = pt((R.rimIn + R.outer) / 2, ang(d + 15));
        const halo = { stroke: "var(--paper)", strokeWidth: 3.5, paintOrder: "stroke" as const };
        return (
          <g key={d}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--ink)" strokeWidth={1} opacity={0.55} />
            <text x={lx} y={ly - 2} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink-2)" {...halo} style={{ fontStretch: "85%", letterSpacing: "0.05em" }}>{MONTH_EN[i]}</text>
            <text x={lx} y={ly + 11} textAnchor="middle" fontSize={11.5} fill="var(--ink-2)" {...halo} style={{ fontFamily: "var(--font-anek-deva)" }}>{MONTH_MR[i]}</text>
          </g>
        );
      })}
    </g>
  );
});

export function SeasonWheel({ plot, onScrub }: { plot: number; onScrub?: () => void }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const setTime = useDesk((s) => s.setTime);
  const setPlaying = useDesk((s) => s.setPlaying);
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const day = Math.floor(t);
  const { d, m, y } = dateOf(day);
  const p = season.plots[plot];
  const stage = stageOn(day, p.baharStart, p.harvestStart, p.harvestStart + 25);
  const a = ang(t);
  // The knob rides the stage band so it never covers the month lettering on the rim.
  const [kx, ky] = pt((R.stageIn + R.stageOut) / 2, a);
  const [px0, py0] = pt(R.core, a);
  const remaining = SEASON_DAYS - t;

  const fromPointer = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * S - C;
    const yy = ((clientY - r.top) / r.height) * S - C;
    let theta = Math.atan2(yy, x) + Math.PI / 2;
    if (theta < 0) theta += Math.PI * 2;
    setTime(Math.min(SEASON_DAYS - 1, Math.floor((theta / (Math.PI * 2)) * SEASON_DAYS)) + 0.23);
  };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${S} ${S}`}
      className="w-full touch-none select-none"
      role="slider"
      tabIndex={0}
      aria-label="Season wheel: drag round to move through the season"
      aria-valuemin={0}
      aria-valuemax={SEASON_DAYS - 1}
      aria-valuenow={day}
      aria-valuetext={`${d} ${MONTHS[m]} ${y}, ${STAGE_LABEL[stage].en}`}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "PageUp" ? 7 : e.key === "PageDown" ? -7 : 0;
        if (step) { e.preventDefault(); onScrub?.(); setTime(Math.max(0, Math.min(SEASON_DAYS - 1, day + step)) + 0.23); }
      }}
      onPointerDown={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const dist = Math.hypot(((e.clientX - r.left) / r.width) * S - C, ((e.clientY - r.top) / r.height) * S - C);
        if (dist < R.core - 4) return;
        dragging.current = true;
        setPlaying(false);
        onScrub?.();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        fromPointer(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (dragging.current) fromPointer(e.clientX, e.clientY); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <defs>
        <mask id="wheel-past">
          <rect width={S} height={S} fill="white" />
          {remaining > 0.01 && <path d={arc(R.core, R.stageOut + 2, Math.min(SEASON_DAYS - 0.001, t), SEASON_DAYS - 0.001)} fill="black" />}
        </mask>
        <mask id="wheel-future">
          <rect width={S} height={S} fill="black" />
          {remaining > 0.01 && <path d={arc(R.core, R.stageOut + 2, Math.min(SEASON_DAYS - 0.001, t), SEASON_DAYS - 0.001)} fill="white" />}
        </mask>
        <filter id="wheel-pencil">
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <circle cx={C} cy={C} r={R.outer} fill="var(--paper)" />
      <g mask="url(#wheel-past)">
        <StageBand season={season} plot={plot} />
      </g>
      <g mask="url(#wheel-future)" filter="url(#wheel-pencil)" opacity={0.45}>
        <StageBand season={season} plot={plot} />
      </g>
      <Marks season={season} plot={plot} today={day} />
      <MonthRim />
      <circle cx={C} cy={C} r={R.outer} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
      <circle cx={C} cy={C} r={R.core} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.2} />
      <line x1={px0} y1={py0} x2={kx} y2={ky} stroke="var(--stamp)" strokeWidth={2.4} />
      <circle cx={kx} cy={ky} r={10} fill="var(--stamp)" stroke="var(--paper)" strokeWidth={2.5} className="cursor-grab" />
      <text x={C} y={C - 18} textAnchor="middle" fontSize={30} fontWeight={700} fill="var(--ink)" className="typed">
        {String(d).padStart(2, "0")} {MONTHS[m]}
      </text>
      <text x={C} y={C + 2} textAnchor="middle" fontSize={11.5} fill="var(--ink-3)" className="typed">
        day {day + 1} · दिवस {mrNum(day + 1)}
      </text>
      <text x={C} y={C + 23} textAnchor="middle" fontSize={14.5} fontWeight={600} fill="var(--ink)">
        {STAGE_LABEL[stage].en}
      </text>
      <text x={C} y={C + 42} textAnchor="middle" fontSize={14.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-anek-deva)" }}>
        {STAGE_LABEL[stage].mr} · {mrDay(day)}
      </text>
    </svg>
  );
}

export function WheelKey() {
  const item = "flex items-center gap-1";
  const mr = { fontFamily: "var(--font-anek-deva)" } as const;
  return (
    <div className="flex flex-wrap justify-center gap-x-2.5 gap-y-0.5 text-[11.5px] leading-tight text-ink-2">
      <span className={item}><span className="h-2.5 w-3.5 rounded-[1px] bg-[#9cc283]" />Stage <span style={mr}>अवस्था</span></span>
      <span className={item}><span className="h-3 w-0.5 bg-water" />Rain <span style={mr}>पाऊस</span></span>
      <span className={item}><span className="size-1.5 rounded-full bg-ink" />Water <span style={mr}>पाणी</span></span>
      <span className={item}><span className="size-2.5 rounded-full border border-water" />Skipped <span style={mr}>टाळले</span></span>
      <span className={item}><span className="size-2 rotate-45 bg-stamp" />Spray <span style={mr}>फवारणी</span></span>
      <span className={item}><X className="size-3 text-alert" strokeWidth={3} aria-hidden />Scan <span style={mr}>स्कॅन</span></span>
      <span className={item}><span className="flex gap-px"><span className="h-2.5 w-0.5 bg-[var(--wave-4)]" /><span className="h-2.5 w-0.5 bg-[var(--wave-4)]" /><span className="h-2.5 w-0.5 bg-[var(--wave-4)]" /></span>Picking <span style={mr}>तोडणी</span></span>
    </div>
  );
}
