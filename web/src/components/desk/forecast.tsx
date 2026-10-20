"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CloudLightning, Pause, Play, Wind, X } from "lucide-react";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { geo, kmBetween } from "@/lib/geo";
import type { LonLat } from "@/lib/sim/types";
import {
  framesFor,
  favourOf,
  frameLabel,
  HORIZON,
  memberFrames,
  spreadForecast,
  stormAt,
  summariseEnsemble,
  TIER,
  TIER_MR,
  type Ensemble,
  type EnsembleForecast,
  type Forecast,
  type Frame,
  type Storm,
  type WindGrid,
} from "@/lib/spread";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;

/** Fetches the live 3 × 3 wind grid and the 51-member ensemble, once an hour. */
export function LiveWindLoader() {
  const setWind = useDesk((s) => s.setWind);
  const setEnsemble = useDesk((s) => s.setEnsemble);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/weather/wind")
        .then((r) => r.json())
        .then((j: WindGrid & { status: string }) => !cancelled && setWind(j.status === "live" ? j : null))
        .catch(() => !cancelled && setWind(null));
      fetch("/api/weather/ensemble")
        .then((r) => r.json())
        .then((j: Ensemble & { status: string }) => !cancelled && setEnsemble(j.status === "live" && j.members?.length ? j : null))
        .catch(() => !cancelled && setEnsemble(null));
    };
    load();
    const id = setInterval(load, 3600_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [setWind, setEnsemble]);
  return null;
}

/** The forecast frames and the spread forecast for the stamped hour (by day while the season plays). */
export function useForecast() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const playing = useDesk((s) => s.playing);
  const wind = useDesk((s) => s.wind);
  const overrides = useDesk((s) => s.overrides);
  const storm = useDesk((s) => s.storm);
  const day = Math.floor(t);
  const key = playing ? day * 24 : Math.floor(t * 24);
  const { frames, source } = useMemo(() => framesFor(season, key / 24 + 0.001, wind, overrides), [season, key, wind, overrides]);
  const points = source === "live" && wind ? wind.points : null;
  const forecast = useMemo(() => spreadForecast(season, day, frames, points, storm), [season, day, frames, points, storm]);
  return { frames, source, forecast, points, day, storm };
}

/**
 * Runs the spread forecast once per ensemble member, a few members per tick so the desk stays responsive,
 * and keeps the summary in the store. Only for the live forecast; a drawn storm is a what-if, so it pauses.
 */
export function EnsembleRunner() {
  const { frames, source, day, storm } = useForecast();
  const season = useDesk((s) => s.season);
  const ensemble = useDesk((s) => s.ensemble);
  const playing = useDesk((s) => s.playing);
  const members = useMemo(() => (source === "live" && ensemble && !storm && !playing ? memberFrames(frames, ensemble) : null), [source, ensemble, storm, playing, frames]);
  useEffect(() => {
    useDesk.setState({ ensembleForecast: null });
    if (!members) return;
    let cancelled = false, i = 0, timer: ReturnType<typeof setTimeout>;
    const out: Forecast[] = [];
    const step = () => {
      if (cancelled) return;
      for (const end = Math.min(members.length, i + 6); i < end; i++) out.push(spreadForecast(season, day, members[i], null));
      if (i < members.length) timer = setTimeout(step, 0);
      else useDesk.setState({ ensembleForecast: summariseEnsemble(season, day, members, out) });
    };
    timer = setTimeout(step, 40);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [members, season, day]);
  return null;
}

const SOURCE_LABEL = {
  live: "Live hourly forecast, 9 points across the taluka (Open-Meteo)",
  recorded: "Recorded weather for these days (Open-Meteo archive), one wind for the taluka",
  simulated: "Simulated weather, one wind for the taluka",
};

const nearestVillage = (at: LonLat) => geo.villages.reduce((best, v) => (kmBetween(v.at, at) < kmBetween(best.at, at) ? v : best), geo.villages[0]);
const barH = (mm: number) => (mm > 0 ? Math.min(18, 4 + mm * 3.5) : 0);

/** 72 hours as a strip: night bands, rain with the ensemble's range, wet canopy, wind arrows, the drawn storm. */
function HourStrip({ frames, hour, onHour, band, storm }: { frames: Frame[]; hour: number | null; onHour: (h: number | null) => void; band: EnsembleForecast["rainBand"] | null; storm: Storm | null }) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 720, H = 66, X = W / HORIZON;
  const pick = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    onHour(Math.max(0, Math.min(frames.length - 1, Math.floor(((clientX - r.left) / r.width) * HORIZON))));
  };
  const at = hour ?? frames.length - 1;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="h-[66px] w-full cursor-ew-resize touch-none select-none"
      role="slider"
      aria-label="Forecast hour"
      aria-valuemin={0}
      aria-valuemax={HORIZON - 1}
      aria-valuenow={at}
      aria-valuetext={frames[at] ? frameLabel(frames[at]) : ""}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") onHour(Math.min(frames.length - 1, at + 1));
        if (e.key === "ArrowLeft") onHour(Math.max(0, at - 1));
        if (e.key === "Escape") onHour(null);
      }}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); pick(e.clientX); }}
      onPointerMove={(e) => { if (e.buttons === 1) pick(e.clientX); }}
      onDoubleClick={() => onHour(null)}
    >
      <defs>
        <pattern id="demo-rain" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--water)" opacity={0.35} />
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--water)" strokeWidth="1.6" />
        </pattern>
        <pattern id="storm-rain" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(-35)">
          <rect width="5" height="5" fill="var(--water)" opacity={0.5} />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink)" strokeWidth="1" opacity={0.6} />
        </pattern>
      </defs>
      {frames.map((f, k) => (f.hour >= 19 || f.hour < 6 ? <rect key={`n${k}`} x={k * X} y={14} width={X + 0.2} height={H - 14} fill="var(--ink)" opacity={0.05} /> : null))}
      {frames.map((f, k) =>
        f.hour === 0 || k === 0 ? (
          <g key={`d${k}`}>
            <line x1={k * X} x2={k * X} y1={0} y2={H} stroke="var(--ink)" strokeOpacity={k ? 0.45 : 0} />
            <text x={k * X + 3} y={10} fontSize={9.5} fontWeight={700} fill="var(--ink-2)" className="typed">{frameLabel(f).slice(0, 3)} {f.hour === 0 ? "" : `${String(f.hour).padStart(2, "0")}:00`}</text>
          </g>
        ) : null,
      )}
      {/* Wet canopy: the hours bacteria can move. */}
      {frames.map((f, k) => {
        const fav = favourOf(f);
        return fav ? <rect key={`w${k}`} x={k * X} y={40} width={X + 0.2} height={7} fill="var(--alert)" opacity={0.25 + fav * 0.6} /> : null;
      })}
      <line x1={0} x2={W} y1={47} y2={47} stroke="var(--ink)" strokeOpacity={0.25} />
      {/* The ensemble's 10–90% range of rain: how sure the forecast is. */}
      {band?.map((b, k) => (b.hi > 0.05 ? <rect key={`b${k}`} x={k * X} y={H - barH(b.hi)} width={X + 0.2} height={barH(b.hi) - barH(b.lo)} fill="var(--water)" opacity={0.22} /> : null))}
      {/* Rain, mm an hour, rising from the base. */}
      {frames.map((f, k) => (f.rain > 0 ? <rect key={`r${k}`} x={k * X + 1} y={H - barH(f.rain)} width={X - 2} height={barH(f.rain)} fill={f.demoRain ? "url(#demo-rain)" : "var(--water)"} /> : null))}
      {/* The storm drawn on the map, at its core. */}
      {storm && frames.map((_, k) => (stormAt(storm, k + 0.5) ? <rect key={`s${k}`} x={k * X + 1} y={H - barH(storm.mm)} width={X - 2} height={barH(storm.mm)} fill="url(#storm-rain)" /> : null))}
      {/* Wind every three hours: an arrow blowing the way the air moves, longer when stronger. */}
      {frames.map((f, k) => {
        if (k % 3) return null;
        const u = f.u.reduce((a, b) => a + b, 0) / f.u.length, v = f.v.reduce((a, b) => a + b, 0) / f.v.length;
        const speed = Math.hypot(u, v);
        const len = Math.min(11, 3 + speed * 0.45);
        const ang = (Math.atan2(-v, u) * 180) / Math.PI;
        return (
          <g key={`a${k}`} transform={`translate(${k * X + X * 1.5},27) rotate(${ang})`} opacity={speed < 1.5 ? 0.35 : 0.85}>
            <line x1={-len} x2={len} stroke="var(--ink)" strokeWidth={1.2} strokeLinecap="round" />
            <path d={`M${len} 0 l-4 -2.6 l0 5.2z`} fill="var(--ink)" />
          </g>
        );
      })}
      {hour !== null && frames[hour] && (
        <g transform={`translate(${hour * X + X / 2},0)`}>
          <rect x={-X / 2 - 1} y={12} width={X + 2} height={H - 12} fill="var(--stamp)" opacity={0.12} />
          <line y1={12} y2={H} stroke="var(--stamp)" strokeWidth={2} />
          <path d="M-5 12 L5 12 L0 18 Z" fill="var(--stamp)" />
        </g>
      )}
    </svg>
  );
}

function headline(forecast: Forecast, frames: Frame[], storm: Storm | null) {
  const top = forecast.villages[0];
  const what = storm ? `What if a storm runs ${nearestVillage(storm.track[0]).name} → ${nearestVillage(storm.track[storm.track.length - 1]).name}: ` : "";
  if (!forecast.sources) return { en: "No blight reported in 14 days: nothing to carry.", mr: "१४ दिवसांत रोगाची नोंद नाही.", tone: "ok" as const };
  if (!forecast.wetHours) return { en: `Dry for ${Math.round(frames.length / 24)} days: blight stays where it is.`, mr: "कोरडे हवामान: रोग पसरण्याची शक्यता कमी.", tone: "ok" as const };
  if (!top || top.tier === 0) return { en: `${what}${forecast.wetHours} wet hours, but no cell downwind gets enough to matter.`, mr: `${forecast.wetHours} ओले तास, पण धोका कमी.`, tone: "ok" as const };
  const peak = top.peak >= 0 ? frameLabel(frames[top.peak]) : "";
  const level = what ? TIER[top.tier].toLowerCase() : TIER[top.tier];
  return { en: `${what}${level} risk downwind, ${geo.villages[top.village].name} from ${peak}.`, mr: `${geo.villages[top.village].mr}: ${TIER_MR[top.tier]} धोका.`, tone: "alert" as const };
}

/** Next 72 hours on the Pest Radar: where reported blight can travel, how sure that is, and who to warn. */
export function SpreadForecast({ className, onLedger }: { className?: string; onLedger: () => void }) {
  const { frames, source, forecast, day, storm } = useForecast();
  const hour = useDesk((s) => s.forecastHour);
  const setHour = useDesk((s) => s.setForecastHour);
  const playing = useDesk((s) => s.forecastPlaying);
  const setPlaying = useDesk((s) => s.setForecastPlaying);
  const warnCells = useDesk((s) => s.warnCells);
  const overrides = useDesk((s) => s.overrides);
  const selectHex = useDesk((s) => s.selectHex);
  const brushing = useDesk((s) => s.brushing);
  const setBrushing = useDesk((s) => s.setBrushing);
  const setStorm = useDesk((s) => s.setStorm);
  const ens = useDesk((s) => s.ensembleForecast);
  const reduce = useReducedMotion();
  const warned = (overrides.advisories ?? []).some((a) => a.day === day);
  const h = headline(forecast, frames, storm);
  const list = forecast.villages.filter((v) => v.tier > 0 || (ens?.villageProb[v.village] ?? 0) >= 0.1).slice(0, 8);

  // Play the 72 hours across the map in about seven seconds.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, start = 0;
    const from = useDesk.getState().forecastHour;
    const first = from !== null && from < frames.length - 1 ? from : 0;
    const step = (ts: number) => {
      start ||= ts;
      const next = Math.min(frames.length - 1, first + Math.floor(((ts - start) / 7000) * HORIZON));
      setHour(next);
      if (next >= frames.length - 1) { setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, frames.length, setHour, setPlaying]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink/20 px-4 pb-1.5 pt-2">
        <p className="flex items-baseline gap-2 text-[15px] font-semibold [font-stretch:92%]">
          <Wind className="size-4 self-center" /> Next 72 hours <span className="font-normal text-ink-2" style={MR}>पुढचे ७२ तास</span>
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={h.en} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className={cn("min-w-0 flex-1 truncate text-[13px]", h.tone === "alert" ? "font-semibold text-alert" : "text-ink-2")} title={h.en}>
            {h.en} <span className="font-normal" style={MR}>{h.mr}</span>
          </motion.p>
        </AnimatePresence>
        <div className="flex shrink-0 items-center gap-2">
          {storm ? (
            <button type="button" onClick={() => setStorm(null)} className="inline-flex min-h-8 items-center gap-1 rounded-[2px] border border-water px-2 text-[12px] font-semibold text-water hover:bg-water hover:text-paper">
              <X className="size-3.5" /> Clear storm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setBrushing(!brushing)}
              aria-pressed={brushing}
              title="Draw a storm's path across the map to see where it would carry blight (a what-if)"
              className={cn("inline-flex min-h-8 items-center gap-1 rounded-[2px] border px-2 text-[12px] font-semibold", brushing ? "border-water bg-water text-paper" : "border-ink/40 hover:border-ink")}
            >
              <CloudLightning className="size-3.5" /> Storm brush
            </button>
          )}
          <SourceStamp live={source === "live"} recorded={source === "recorded"} label={SOURCE_LABEL[source]} />
          <button type="button" onClick={onLedger} className="text-[12px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">Ledger</button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1">
        <button
          type="button"
          onClick={() => (playing ? setPlaying(false) : reduce ? setHour(frames.length - 1) : setPlaying(true))}
          aria-label={playing ? "Pause the forecast" : "Play the forecast across the map"}
          className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-ink hover:text-paper"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <HourStrip frames={frames} hour={hour} onHour={(x) => { setPlaying(false); setHour(x); }} band={ens?.rainBand ?? null} storm={storm} />
        </div>
        <div className="flex w-[150px] shrink-0 flex-col items-end gap-1">
          <p className="typed text-right text-[11px] leading-none text-ink-3" title={ens ? `${ens.members}-member ECMWF ensemble; shaded band: 10–90% of members` : undefined}>
            {hour !== null && frames[hour] ? <><span className="font-bold text-stamp">{frameLabel(frames[hour])}</span> · {frames[hour].rain ? `${frames[hour].rain} mm` : `RH ${frames[hour].rh}%`}</> : <>72 h · {forecast.rainMm} mm{ens ? ` · ${ens.members} runs` : ""}</>}
          </p>
          {warned ? (
            <Stamp tone="stamp" size="sm" rotate={-3}>Advisory sent</Stamp>
          ) : (
            <StampButton
              tone="stamp"
              disabled={!forecast.warnHexes.length || Boolean(storm)}
              title={storm ? "A drawn storm is a what-if: clear it to send real advisories" : undefined}
              onClick={() => warnCells(forecast.warnHexes, forecast.warnPlots)}
              className="min-h-10 w-full px-2"
            >
              <span className="block text-center leading-tight">
                <span className="block whitespace-nowrap text-[13px] font-bold">{storm ? "What-if only" : forecast.warnHexes.length ? `Warn ${forecast.warnPlots} ${forecast.warnPlots === 1 ? "plot" : "plots"}` : "Nobody to warn"}</span>
                {forecast.warnHexes.length && !storm ? <span className="block whitespace-nowrap text-[10.5px] opacity-90">{forecast.warnApp} app · {forecast.warnPlots - forecast.warnApp} SMS</span> : null}
              </span>
            </StampButton>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-wrap items-start gap-x-2 gap-y-1.5 overflow-y-auto px-4 pb-2 pt-1">
        {brushing ? (
          <p className="text-[12.5px] font-semibold text-water">Drag across the map to draw the storm&apos;s path: it moves at about 12 km/h, raining hardest at its core. <span className="font-normal" style={MR}>नकाशावर वादळाचा मार्ग ओढा.</span></p>
        ) : list.length === 0 ? (
          <p className="text-[12px] text-ink-3">
            Wet hours drive spread: rain splash and wind carry bacteria from reported cells.{" "}
            {ens ? `All ${ens.members} ensemble runs agree: ${forecast.rainMm < 1 ? "dry" : "little rain"}. ` : ""}
            Try the storm brush, or the demo rain, to see what a storm would do.
          </p>
        ) : (
          list.map((v) => {
            const p = ens?.villageProb[v.village];
            return (
              <button
                key={v.village}
                type="button"
                onClick={() => selectHex(v.hexes.reduce((a, i) => (forecast.exposure[i] > forecast.exposure[a] ? i : a), v.hexes[0]))}
                className={cn("flex items-baseline gap-1.5 rounded-[2px] border px-2 py-1 text-left text-[12px] leading-tight hover:border-ink", v.tier >= 2 ? "border-stamp/60 bg-[color-mix(in_oklab,var(--stamp)_9%,var(--paper))]" : "border-ink/25")}
              >
                <span className="font-semibold">{geo.villages[v.village].name}</span>
                <span className={cn("label-form text-[9.5px]", v.tier >= 2 ? "text-stamp" : "text-ink-3")}>{TIER[v.tier]}</span>
                {p !== undefined && p > 0 && <span className="typed text-[10.5px] font-bold text-stamp" title={`${Math.round(p * 100)}% of ${ens?.members} ensemble runs reach moderate or more`}>{Math.round(p * 100)}%</span>}
                {v.peak >= 0 && <span className="typed text-[10.5px] text-ink-3">{frameLabel(frames[v.peak])}</span>}
                {v.warned > 0 && <span className="typed text-[10.5px] text-ink-2">{v.warned} {v.warned === 1 ? "plot" : "plots"}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
