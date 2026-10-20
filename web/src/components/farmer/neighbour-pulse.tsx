"use client";

import { useMemo } from "react";
import { Sheet, SheetHead } from "@/components/record/sheet";
import { SourceStamp } from "@/components/record/stamp";
import { mrNum } from "@/lib/farmer";
import { bearing, geo, kmBetween } from "@/lib/geo";
import { framesFor, spreadForecast, TIER, TIER_MR } from "@/lib/spread";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
const RADIUS_KM = 4;
const SIZE = 150, C = SIZE / 2, PX = (SIZE / 2 - 6) / RADIUS_KM;
const KM_LON = 111.32 * Math.cos((17.99 * Math.PI) / 180), KM_LAT = 110.57;
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const COMPASS_MR = ["उत्तर", "ईशान्य", "पूर्व", "आग्नेय", "दक्षिण", "नैऋत्य", "पश्चिम", "वायव्य"];
const point = (deg: number) => Math.round((((deg % 360) + 360) % 360) / 45) % 8;

/**
 * Around your plot: the H3 cells within 4 km, by reported blight and by the next 72 hours' exposure.
 * The farmer sees the collective picture without ever seeing a neighbour's plot.
 */
export function NeighbourPulse({ plot }: { plot: number }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const wind = useDesk((s) => s.wind);
  const overrides = useDesk((s) => s.overrides);
  const day = Math.floor(t);
  const hour = Math.floor(t * 24);
  const p = season.plots[plot];
  const centre = geo.hexes[p.hex].center;

  const { frames, forecast } = useMemo(() => {
    const f = framesFor(season, hour / 24 + 0.001, wind, overrides);
    const pts = f.source === "live" && wind ? wind.points : null;
    return { frames: f.frames, forecast: spreadForecast(season, day, f.frames, pts) };
  }, [season, hour, day, wind, overrides]);

  const near = useMemo(
    () => geo.hexes.flatMap((h, i) => {
      const km = kmBetween(centre, h.center);
      if (km > RADIUS_KM + 1) return [];
      const d = h.ring.map(([lon, lat]) => `${(C + (lon - centre[0]) * KM_LON * PX).toFixed(1)},${(C - (lat - centre[1]) * KM_LAT * PX).toFixed(1)}`).join(" ");
      return [{ i, km, d }];
    }),
    [centre],
  );

  const risk = season.hexRisk[day];
  const det = season.hexDetections[day];
  const scans = near.filter((n) => n.km <= 3.2).reduce((a, n) => a + det[n.i], 0);
  const reported = near.filter((n) => risk[n.i] > 0 && n.i !== p.hex).sort((a, b) => a.km - b.km)[0];
  const mine = forecast.tier[p.hex];
  const f0 = frames[0];
  const u = f0 ? f0.u.reduce((a, b) => a + b, 0) / f0.u.length : 0, v = f0 ? f0.v.reduce((a, b) => a + b, 0) / f0.v.length : 0;
  const speed = Math.round(Math.hypot(u, v));
  const towards = (Math.atan2(u, v) * 180) / Math.PI;
  const from = point(towards + 180);

  return (
    <Sheet>
      <SheetHead form="KK-8" title="Around your plot" mr="तुमच्या शेताभोवती" right={<SourceStamp live={false} label="Reports from the simulated network; forecast from Open-Meteo" />} />
      <div className="flex items-center gap-3 px-3 py-3">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-[138px] shrink-0" role="img" aria-label={`Cells within ${RADIUS_KM} km: ${scans} blight scans reported in 14 days`}>
          <defs>
            <clipPath id="pulse-clip"><circle cx={C} cy={C} r={C - 4} /></clipPath>
            <pattern id="pulse-risk" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke="var(--alert)" strokeWidth="1.3" />
            </pattern>
            <pattern id="pulse-fc" patternUnits="userSpaceOnUse" width="4" height="4">
              <circle cx="1.5" cy="1.5" r="1" fill="var(--stamp)" />
            </pattern>
            <linearGradient id="pulse-sweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--stamp)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--stamp)" stopOpacity="0.28" />
            </linearGradient>
          </defs>
          <circle cx={C} cy={C} r={C - 4} fill="var(--paper-2)" />
          <g clipPath="url(#pulse-clip)">
            {near.map((n) => (
              <polygon
                key={n.i}
                points={n.d}
                fill={risk[n.i] >= 2 ? "var(--alert)" : risk[n.i] === 1 ? "url(#pulse-risk)" : forecast.tier[n.i] >= 1 ? "url(#pulse-fc)" : "transparent"}
                fillOpacity={risk[n.i] >= 2 ? 0.45 : 1}
                stroke="var(--ink)"
                strokeOpacity={0.18}
                strokeWidth={0.7}
              />
            ))}
            {/* The sweep: a slow pass of the radar arm, still when motion is reduced. */}
            <g className="motion-safe:animate-[spin_6s_linear_infinite]" style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}>
              <path d={`M${C} ${C} L${SIZE} ${C} A${C} ${C} 0 0 0 ${C + C * Math.cos(Math.PI / 5)} ${C - C * Math.sin(Math.PI / 5)} Z`} fill="url(#pulse-sweep)" />
            </g>
          </g>
          {[1, 2, 3, 4].map((k) => <circle key={k} cx={C} cy={C} r={k * PX} fill="none" stroke="var(--ink)" strokeOpacity={k === 4 ? 0.5 : 0.18} strokeDasharray={k === 4 ? undefined : "2 3"} />)}
          <text x={C + 2 * PX + 2} y={C - 2} fontSize={8} className="typed" fill="var(--ink-3)">2 km</text>
          {/* Wind: an arrow on the rim blowing the way the air moves. */}
          {speed > 0 && (
            <g transform={`translate(${C},${C}) rotate(${towards - 90})`}>
              <line x1={C - 26} x2={C - 8} y1={0} y2={0} stroke="var(--ink)" strokeWidth={1.6} />
              <path d={`M${C - 8} 0 l-5 -3 l0 6z`} fill="var(--ink)" />
            </g>
          )}
          <circle cx={C} cy={C} r={5} fill="var(--stamp)" stroke="var(--paper)" strokeWidth={2} />
        </svg>
        <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
          <p className={cn("font-semibold", scans ? "text-alert" : "text-ink")}>
            {scans ? `${scans} blight ${scans === 1 ? "scan" : "scans"} reported within 3 km in 14 days` : "No blight reported within 3 km in 14 days"}
          </p>
          <p style={MR}>{scans ? `३ किमीमध्ये १४ दिवसांत ${mrNum(scans)} नोंदी` : "३ किमीमध्ये १४ दिवसांत नोंद नाही"}</p>
          {reported && (
            <p className="mt-1 text-ink-2">
              Nearest reported cell {reported.km.toFixed(1)} km {COMPASS[point(bearing(centre, geo.hexes[reported.i].center))]}
              <span className="block" style={MR}>सर्वात जवळ {mrNum(reported.km.toFixed(1))} किमी, {COMPASS_MR[point(bearing(centre, geo.hexes[reported.i].center))]}</span>
            </p>
          )}
          <p className={cn("mt-1 font-semibold", mine >= 2 ? "text-alert" : "text-stamp")}>
            Next 72 h at your plot: {TIER[mine].toLowerCase()}
            <span className="block font-normal" style={MR}>पुढचे ७२ तास: {TIER_MR[mine]}</span>
          </p>
          {speed > 0 && <p className="typed mt-1 text-[11px] text-ink-3">wind from the {COMPASS[from]}, {speed} km/h</p>}
        </div>
      </div>
      <p className="border-t border-ink/15 px-4 py-1.5 text-[11px] text-ink-3">Cells of about 5 km², never a neighbour&apos;s plot. <span style={MR}>फक्त विभाग, शेजाऱ्यांची शेते नाहीत.</span></p>
    </Sheet>
  );
}
