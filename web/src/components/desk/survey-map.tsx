"use client";

import { memo, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cellLabel, geo } from "@/lib/geo";
import { frameLabel, stormAt, TIER } from "@/lib/spread";
import type { LonLat } from "@/lib/sim/types";
import { useForecast } from "./forecast";
import { WindField } from "./wind-field";
import { focusWeek, villageCrates, waterShareByVillage } from "@/lib/sim/selectors";
import { useDesk, type Layer } from "@/lib/store";
import {
  apmc,
  boundaryPath,
  canals,
  fields,
  fieldTint,
  hexes,
  hubTint,
  kmPerUnit,
  labelPlacement,
  MAP_H,
  MAP_W,
  pointAlong,
  project,
  projection,
  rail,
  rivers,
  roads,
  routes,
  villages,
} from "./map-geometry";

const WAVE = ["var(--wave-0)", "var(--wave-1)", "var(--wave-2)", "var(--wave-3)", "var(--wave-4)"];
const WAVE_STEPS = [1, 60, 220, 520, 900];
const waveFill = (crates: number) => {
  let k = 0;
  WAVE_STEPS.forEach((s, i) => { if (crates >= s) k = i; });
  return crates < 1 ? "var(--paper)" : WAVE[k];
};
const WATER = ["#f4f5f0", "#d7e8c8", "#b4d39c", "#87b874", "#5a9752"];

function Patterns() {
  return (
    <defs>
      <pattern id="risk-1" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="var(--alert)" strokeWidth="1.1" />
      </pattern>
      <pattern id="risk-2" patternUnits="userSpaceOnUse" width="5.5" height="5.5" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5.5" stroke="var(--alert)" strokeWidth="1.3" />
        <line x1="0" y1="0" x2="5.5" y2="0" stroke="var(--alert)" strokeWidth="1.3" />
      </pattern>
      <pattern id="risk-3" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
        <rect width="4" height="4" fill="var(--alert)" opacity="0.45" />
        <line x1="0" y1="0" x2="0" y2="4" stroke="var(--alert)" strokeWidth="1.6" />
        <line x1="0" y1="0" x2="4" y2="0" stroke="var(--alert)" strokeWidth="1.6" />
      </pattern>
      <pattern id="paper-grain" patternUnits="userSpaceOnUse" width="120" height="120">
        <filter id="grain-f">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.11  0 0 0 0 0.10  0 0 0 0 0.09  0 0 0 0.05 0" />
        </filter>
        <rect width="120" height="120" filter="url(#grain-f)" />
      </pattern>
      {[1, 2, 3].map((k) => (
        <pattern key={k} id={`fc-${k}`} patternUnits="userSpaceOnUse" width={[0, 7, 5, 4][k]} height={[0, 7, 5, 4][k]}>
          <circle cx={1.5} cy={1.5} r={[0, 0.9, 1.1, 1.3][k]} fill="var(--stamp)" opacity={[0, 0.55, 0.75, 0.9][k]} />
        </pattern>
      ))}
      <pattern id="storm-cell" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-35)">
        <rect width="6" height="6" fill="var(--water)" opacity={0.18} />
        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--water)" strokeWidth="1.2" opacity={0.7} />
      </pattern>
      <marker id="storm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
        <path d="M0 0L10 5L0 10z" fill="var(--water)" />
      </marker>
      <clipPath id="taluka-clip">
        <path d={boundaryPath} />
      </clipPath>
      <marker id="run-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
        <path d="M0 0L10 5L0 10z" fill="var(--stamp)" />
      </marker>
    </defs>
  );
}

/** Static linework: drawn once, never re-rendered by time. */
const Linework = memo(function Linework() {
  return (
    <g>
      <g fill="none" stroke="var(--canal)" strokeWidth={0.9} strokeDasharray="5 2" opacity={0.85}>
        {canals.map((c, i) => <path key={i} d={c.d} />)}
      </g>
      <g fill="none" stroke="var(--water)" strokeLinecap="round" strokeLinejoin="round">
        {rivers.map((r, i) => <path key={i} d={r.d} strokeWidth={r.name?.startsWith("Nira") ? 2.4 : 1.5} />)}
      </g>
      <g fill="none" stroke="var(--road)" strokeLinecap="round" strokeLinejoin="round">
        {roads.map((r, i) => <path key={i} d={r.d} strokeWidth={r.major ? 1.5 : 0.8} opacity={r.major ? 0.9 : 0.7} />)}
      </g>
      <g fill="none" stroke="var(--ink)">
        {rail.map((r, i) => <path key={i} d={r.d} strokeWidth={2.6} opacity={0.85} />)}
        {rail.map((r, i) => <path key={`t${i}`} d={r.d} strokeWidth={1.4} stroke="var(--paper)" strokeDasharray="5 5" />)}
      </g>
      <path d={boundaryPath} fill="none" stroke="var(--ink)" strokeWidth={2.2} strokeDasharray="14 4 2 4" />
    </g>
  );
});

const Labels = memo(function Labels({ layer }: { layer: Layer }) {
  return (
    <g>
      {villages.map((v, vi) => {
        const place = labelPlacement[vi];
        const isHub = geo.hubs.includes(v.id);
        const town = v.kind === "town";
        return (
          <g key={v.id} transform={`translate(${v.x},${v.y})`} className="pointer-events-none">
            {isHub && layer === "runs" ? (
              <rect x={-4.5} y={-4.5} width={9} height={9} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.6} />
            ) : (
              <circle r={town ? 3.6 : 2.4} fill="var(--ink)" />
            )}
            <text
              x={place.dx}
              y={place.dy}
              textAnchor={place.anchor}
              fontSize={town ? 15 : 12.5}
              fontWeight={town ? 700 : 600}
              fill="var(--ink)"
              stroke="var(--paper)"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ fontStretch: "88%", letterSpacing: town ? "0.04em" : "0.01em", textTransform: town ? "uppercase" : "none" }}
            >
              {v.name}
            </text>
            {place.mr && <text x={place.dx} y={place.dy + 14} textAnchor={place.anchor} fontSize={12} fill="var(--ink-2)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke" style={{ fontFamily: "var(--font-anek-deva)" }}>
              {v.mr}
            </text>}
          </g>
        );
      })}
      <g transform={`translate(${apmc.x},${apmc.y})`} className="pointer-events-none">
        <circle r={8} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
        <circle r={3} fill="var(--ink)" />
      </g>
    </g>
  );
});

function Fields({ layer, day }: { layer: Layer; day: number }) {
  const season = useDesk((s) => s.season);
  const waveWeek = useDesk((s) => s.waveWeek);
  const fills = useMemo(() => {
    if (layer === "wave") {
      const crates = villageCrates(season, focusWeek(season, day, waveWeek));
      return crates.map(waveFill);
    }
    if (layer === "water") {
      const { saved } = waterShareByVillage(season, day);
      const max = Math.max(1, ...saved);
      return saved.map((v) => WATER[Math.min(4, Math.floor((v / max) * 4.99))]);
    }
    if (layer === "runs") return villages.map((v) => hubTint.get(v.hub) ?? "var(--f-straw)");
    // Pest Radar keeps each village its own pale field so the red hatching reads on top.
    return fieldTint.map((tint) => `color-mix(in oklab, ${tint === "var(--f-aril)" ? "var(--f-straw)" : tint} 40%, var(--paper))`);
  }, [layer, day, season, waveWeek]);
  return (
    <g clipPath="url(#taluka-clip)">
      {fields.map((d, i) => (
        <path key={i} d={d} fill={fills[i]} stroke="var(--paper)" strokeWidth={1.2} style={{ transition: "fill 220ms ease-out" }} />
      ))}
    </g>
  );
}

function RiskHexes({ day, onHover }: { day: number; onHover: (h: number | null) => void }) {
  const season = useDesk((s) => s.season);
  const selectedHex = useDesk((s) => s.selectedHex);
  const selectHex = useDesk((s) => s.selectHex);
  const risk = season.hexRisk[day];
  const det = season.hexDetections[day];
  return (
    <g>
      {hexes.map((h, i) => (
        <path
          key={i}
          d={h.d}
          fill={risk[i] ? `url(#risk-${risk[i]})` : "transparent"}
          stroke="var(--ink)"
          strokeOpacity={risk[i] ? 0.5 : 0.13}
          strokeWidth={risk[i] ? 0.9 : 0.6}
          className="cursor-pointer"
          onPointerEnter={() => onHover(i)}
          onPointerLeave={() => onHover(null)}
          onClick={() => selectHex(selectedHex === i ? null : i)}
        />
      ))}
      {hexes.map((h, i) =>
        det[i] ? (
          <text key={`d${i}`} x={h.cx} y={h.cy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--alert)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke" className="pointer-events-none typed">
            {det[i]}
          </text>
        ) : null,
      )}
      {selectedHex !== null && (
        <path d={hexes[selectedHex].d} fill="none" stroke="var(--stamp)" strokeWidth={3} className="pointer-events-none" />
      )}
    </g>
  );
}

/** Where the next 72 hours can carry blight, accumulated up to the scrubbed hour: violet stipple, densest where most arrives. */
function Exposure({ onHover }: { onHover: (h: number | null) => void }) {
  const { forecast } = useForecast();
  const hour = useDesk((s) => s.forecastHour);
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const risk = season.hexRisk[Math.floor(t)];
  const upto = forecast.cumulative[hour ?? forecast.cumulative.length - 1];
  const ens = useDesk((s) => s.ensembleForecast);
  const storm = useDesk((s) => s.storm);
  if (!upto) return null;
  return (
    <g>
      {ens && !storm && hour === null && hexes.map((h, i) =>
        ens.prob[i] >= 0.1 && risk[i] < 2 ? (
          <text key={`p${i}`} x={h.cx} y={h.cy + 3.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--stamp)" stroke="var(--paper)" strokeWidth={2.5} paintOrder="stroke" className="typed pointer-events-none">
            {Math.round(ens.prob[i] * 100)}%
          </text>
        ) : null,
      )}
      {hexes.map((h, i) => {
        const e = upto[i];
        const tier = e >= 4 ? 3 : e >= 1.2 ? 2 : e >= 0.35 ? 1 : 0;
        if (!tier || risk[i] >= 2) return null;
        return (
          <path
            key={i}
            d={h.d}
            fill={`url(#fc-${tier})`}
            stroke="var(--stamp)"
            strokeWidth={tier >= 2 ? 1.3 : 0.8}
            strokeDasharray={tier >= 2 ? undefined : "3 2"}
            strokeOpacity={0.75}
            style={{ transition: "fill 160ms ease-out" }}
            onPointerEnter={() => onHover(i)}
            onPointerLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
}

/** The storm drawn with the brush: its path, and the rain cell where it is at the scrubbed hour. */
function StormTrack() {
  const storm = useDesk((s) => s.storm);
  const hour = useDesk((s) => s.forecastHour);
  if (!storm) return null;
  const pts = storm.track.map(project);
  const d = `M${pts.map((p) => p.join(",")).join("L")}`;
  const now = hour !== null ? stormAt(storm, hour + 0.5) : null;
  const r = storm.radiusKm / kmPerUnit;
  const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
  const centre = now ? project(now.at) : null;
  return (
    <g className="pointer-events-none">
      <path d={d} fill="none" stroke="var(--water)" strokeOpacity={0.16} strokeWidth={r * 1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--water)" strokeWidth={2} strokeDasharray="7 4" markerEnd="url(#storm-arrow)" />
      <circle cx={sx} cy={sy} r={4} fill="var(--paper)" stroke="var(--water)" strokeWidth={2} />
      <text x={sx + 8} y={sy - 6} fontSize={10.5} fontWeight={700} fill="var(--water)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke" className="typed">STORM +{storm.start} h</text>
      <text x={ex + 8} y={ey + 14} fontSize={10.5} fontWeight={700} fill="var(--water)" stroke="var(--paper)" strokeWidth={3} paintOrder="stroke" className="typed">+{storm.start + storm.hours} h</text>
      {centre && (
        <g>
          <circle cx={centre[0]} cy={centre[1]} r={r} fill="url(#storm-cell)" stroke="var(--water)" strokeWidth={1.6} />
          <circle cx={centre[0]} cy={centre[1]} r={r * 0.35} fill="var(--water)" opacity={0.35} />
        </g>
      )}
    </g>
  );
}

/** Drag across the map to draw a storm's path; on release it becomes a six-hour what-if storm. */
function StormBrush() {
  const brushing = useDesk((s) => s.brushing);
  const setStorm = useDesk((s) => s.setStorm);
  const setBrushing = useDesk((s) => s.setBrushing);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [pts, setPts] = useState<[number, number][]>([]);
  if (!brushing) return null;
  const toMap = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * MAP_W, ((e.clientY - r.top) / r.height) * MAP_H];
  };
  const finish = () => {
    const track = pts.map((p) => projection.invert!(p) as LonLat);
    const km = pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) * kmPerUnit : 0), 0);
    setPts([]);
    if (km < 3) return;
    // A convective storm moves at about 12 km/h: a longer path takes longer to cross (3 to 8 hours).
    setStorm({ track, start: 1, hours: Math.min(8, Math.max(3, Math.round(km / 12))), mm: 8, radiusKm: 4 });
    useDesk.setState(reduce ? { forecastHour: 4 } : { forecastHour: 0, forecastPlaying: true });
  };
  return (
    <div
      ref={ref}
      className="absolute inset-0 z-10 cursor-crosshair touch-none"
      role="application"
      aria-label="Draw a storm's path: drag across the map"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setPts([toMap(e)]); }}
      onPointerMove={(e) => {
        if (!pts.length || e.buttons !== 1) return;
        const p = toMap(e), last = pts[pts.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 8) setPts([...pts, p]);
      }}
      onPointerUp={finish}
      onKeyDown={(e) => { if (e.key === "Escape") setBrushing(false); }}
      tabIndex={0}
    >
      <div className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklab,var(--water)_6%,transparent)] outline outline-2 -outline-offset-2 outline-water/60" />
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="pointer-events-none absolute inset-0 h-full w-full">
        {pts.length > 1 && <path d={`M${pts.map((p) => p.join(",")).join("L")}`} fill="none" stroke="var(--water)" strokeWidth={10} strokeOpacity={0.35} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </div>
  );
}

function Runs() {
  const t = useDesk((s) => s.t);
  const season = useDesk((s) => s.season);
  const day = Math.floor(t);
  const hour = (t - day) * 24;
  const today = season.runsByDay[day] ?? [];
  const activeHubs = new Set(today.map((r) => r.hub));
  return (
    <g>
      {[...routes.entries()].map(([hub, r]) => (
        <path
          key={hub}
          d={r.d}
          fill="none"
          stroke="var(--stamp)"
          strokeWidth={activeHubs.has(hub) ? 3 : 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={activeHubs.has(hub) ? undefined : "4 4"}
          opacity={activeHubs.has(hub) ? 0.9 : 0.55}
          markerEnd="url(#run-arrow)"
        />
      ))}
      {today
        .filter((r) => r.km < 60)
        .map((r, i) => {
          const travel = r.km / 28;
          const frac = (hour - r.departHour - (i % 3) * 0.05) / travel;
          if (frac <= 0 || frac >= 1) return null;
          const p = pointAlong(r.hub, frac);
          if (!p) return null;
          return (
            <g key={r.id} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`}>
              <rect x={-7} y={-4} width={14} height={8} rx={1.5} fill="var(--stamp)" stroke="var(--paper)" strokeWidth={1.2} />
              <rect x={3} y={-3} width={3.5} height={6} fill="var(--paper)" opacity={0.85} />
            </g>
          );
        })}
    </g>
  );
}

function ScaleBar() {
  const km = 10;
  const len = Math.round(km / kmPerUnit);
  return (
    <g transform={`translate(${MAP_W - 34 - len},${MAP_H - 26})`} className="pointer-events-none">
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={(i * len) / 5} y={0} width={len / 5} height={5} fill={i % 2 ? "var(--paper)" : "var(--ink)"} stroke="var(--ink)" strokeWidth={0.8} />
      ))}
      <text x={0} y={-4} fontSize={9.5} className="typed" fill="var(--ink)">0</text>
      <text x={len} y={-4} fontSize={9.5} textAnchor="end" className="typed" fill="var(--ink)">{km} km</text>
    </g>
  );
}

function NorthArrow() {
  return (
    <g transform={`translate(${MAP_W - 52},${56})`} className="pointer-events-none">
      <path d="M0 -22 L8 6 L0 0 L-8 6 Z" fill="var(--ink)" />
      <path d="M0 -22 L0 0 L-8 6 Z" fill="var(--paper)" stroke="var(--ink)" strokeWidth={1} />
      <text y={20} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">N</text>
    </g>
  );
}

export function SurveyMap() {
  const layer = useDesk((s) => s.layer);
  const t = useDesk((s) => s.t);
  const day = Math.floor(t);
  const season = useDesk((s) => s.season);
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover !== null ? geo.hexes[hover] : null;
  const { frames, forecast, points, storm } = useForecast();
  const forecastHour = useDesk((s) => s.forecastHour);
  const hoverPlots = hover !== null ? season.plots.filter((p) => p.hex === hover).length : 0;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Survey map of Phaltan taluka with the active layer">
        <Patterns />
        <Fields layer={layer} day={day} />
        <Linework />
        {layer === "pest" && <Exposure onHover={setHover} />}
        {layer === "pest" && <RiskHexes day={day} onHover={setHover} />}
        {layer === "runs" && <Runs />}
        {layer === "pest" && <StormTrack />}
        <Labels layer={layer} />
        <NorthArrow />
        <ScaleBar />
        <rect width={MAP_W} height={MAP_H} fill="url(#paper-grain)" className="pointer-events-none" />
      </svg>
      {layer === "pest" && <WindField frame={frames[forecastHour ?? 0]} k={forecastHour ?? 0} points={points} storm={storm} />}
      {layer === "pest" && <StormBrush />}
      <AnimatePresence>
        {hovered && hover !== null && (
          <motion.div
            key="hover"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute bottom-4 left-4 w-56 rounded-[2px] bg-paper px-3 py-2 text-[12px] shadow-[var(--shadow-lift)]"
          >
            <p className="typed text-[10.5px] text-ink-3">CELL {cellLabel(hovered.id)}</p>
            <p className="mt-0.5 font-semibold">Near {geo.villages[hovered.village].name}</p>
            <p className="text-ink-2">
              {["No blight reported", "Watch", "Warning", "Outbreak"][season.hexRisk[day][hover]]}
              {season.hexDetections[day][hover] ? `, ${season.hexDetections[day][hover]} reported in 14 days` : ""}
            </p>
            {forecast.tier[hover] > 0 && season.hexRisk[day][hover] < 2 && (
              <p className="font-semibold text-stamp">
                Next 72 h: {TIER[forecast.tier[hover]].toLowerCase()} exposure{forecast.peak[hover] >= 0 ? `, peak ${frameLabel(frames[forecast.peak[hover]])}` : ""}
              </p>
            )}
            <p className="text-ink-3">{hoverPlots} plots on record</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
