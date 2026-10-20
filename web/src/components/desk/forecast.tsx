"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, Wind } from "lucide-react";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { geo } from "@/lib/geo";
import { framesFor, favourOf, frameLabel, HORIZON, spreadForecast, TIER, TIER_MR, type Frame, type WindGrid } from "@/lib/spread";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;

/** Fetches the live 3 × 3 wind grid once an hour. */
export function LiveWindLoader() {
  const setWind = useDesk((s) => s.setWind);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/weather/wind")
        .then((r) => r.json())
        .then((j: WindGrid & { status: string }) => !cancelled && setWind(j.status === "live" ? j : null))
        .catch(() => !cancelled && setWind(null));
    load();
    const id = setInterval(load, 3600_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [setWind]);
  return null;
}

/** The forecast frames and the spread forecast for the stamped hour (by day while the season plays). */
export function useForecast() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const playing = useDesk((s) => s.playing);
  const wind = useDesk((s) => s.wind);
  const overrides = useDesk((s) => s.overrides);
  const day = Math.floor(t);
  const key = playing ? day * 24 : Math.floor(t * 24);
  const { frames, source } = useMemo(() => framesFor(season, key / 24 + 0.001, wind, overrides), [season, key, wind, overrides]);
  const points = source === "live" && wind ? wind.points : null;
  const forecast = useMemo(() => spreadForecast(season, day, frames, points), [season, day, frames, points]);
  return { frames, source, forecast, points, day };
}

const SOURCE_LABEL = {
  live: "Live hourly forecast, 9 points across the taluka (Open-Meteo)",
  recorded: "Recorded weather for these days (Open-Meteo archive), one wind for the taluka",
  simulated: "Simulated weather, one wind for the taluka",
};

/** 72 hours as a strip: night bands, rain, wet canopy, wind arrows; drag to scrub the map through them. */
function HourStrip({ frames, hour, onHour }: { frames: Frame[]; hour: number | null; onHour: (h: number | null) => void }) {
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
      {/* Rain, mm an hour, rising from the base. */}
      {frames.map((f, k) =>
        f.rain > 0 ? <rect key={`r${k}`} x={k * X + 1} y={H - Math.min(18, 4 + f.rain * 3.5)} width={X - 2} height={Math.min(18, 4 + f.rain * 3.5)} fill={f.demoRain ? "url(#demo-rain)" : "var(--water)"} /> : null,
      )}
      <defs>
        <pattern id="demo-rain" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="var(--water)" opacity={0.35} />
          <line x1="0" y1="0" x2="0" y2="4" stroke="var(--water)" strokeWidth="1.6" />
        </pattern>
      </defs>
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

function headline(forecast: ReturnType<typeof useForecast>["forecast"], frames: Frame[]) {
  const top = forecast.villages[0];
  if (!forecast.sources) return { en: "No blight reported in 14 days: nothing to carry.", mr: "१४ दिवसांत रोगाची नोंद नाही.", tone: "ok" as const };
  if (!forecast.wetHours) return { en: `Dry for ${Math.round(frames.length / 24)} days: blight stays where it is.`, mr: "कोरडे हवामान: रोग पसरण्याची शक्यता कमी.", tone: "ok" as const };
  if (!top || top.tier === 0) return { en: `${forecast.wetHours} wet hours, but no cell downwind gets enough to matter.`, mr: `${forecast.wetHours} ओले तास, पण धोका कमी.`, tone: "ok" as const };
  const peak = top.peak >= 0 ? frameLabel(frames[top.peak]) : "";
  return { en: `${TIER[top.tier]} risk downwind: ${geo.villages[top.village].name}, from ${peak}.`, mr: `${geo.villages[top.village].mr}: ${TIER_MR[top.tier]} धोका.`, tone: "alert" as const };
}

/** Next 72 hours on the Pest Radar: where reported blight can travel, and who to warn before it does. */
export function SpreadForecast({ className, onLedger }: { className?: string; onLedger: () => void }) {
  const { frames, source, forecast, day } = useForecast();
  const hour = useDesk((s) => s.forecastHour);
  const setHour = useDesk((s) => s.setForecastHour);
  const warnCells = useDesk((s) => s.warnCells);
  const overrides = useDesk((s) => s.overrides);
  const selectHex = useDesk((s) => s.selectHex);
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const warned = (overrides.advisories ?? []).some((a) => a.day === day);
  const h = headline(forecast, frames);
  const list = forecast.villages.filter((v) => v.tier > 0).slice(0, 8);

  // Play the 72 hours across the map in about seven seconds.
  useEffect(() => {
    if (!playing) return;
    let raf = 0, start = 0;
    const from = hour !== null && hour < frames.length - 1 ? hour : 0;
    const step = (ts: number) => {
      start ||= ts;
      const next = Math.min(frames.length - 1, from + Math.floor(((ts - start) / 7000) * HORIZON));
      setHour(next);
      if (next >= frames.length - 1) { setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the start hour is read once when play begins
  }, [playing, frames.length, setHour]);

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
          <SourceStamp live={source === "live"} recorded={source === "recorded"} label={SOURCE_LABEL[source]} />
          <button type="button" onClick={onLedger} className="text-[12px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">Village ledger</button>
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
          <HourStrip frames={frames} hour={hour} onHour={(x) => { setPlaying(false); setHour(x); }} />
        </div>
        <div className="flex w-[150px] shrink-0 flex-col items-end gap-1">
          <p className="typed text-right text-[11px] leading-none text-ink-3">
            {hour !== null && frames[hour] ? <><span className="font-bold text-stamp">{frameLabel(frames[hour])}</span> · {frames[hour].rain ? `${frames[hour].rain} mm` : `RH ${frames[hour].rh}%`}</> : <>72 h · {forecast.rainMm} mm rain</>}
          </p>
          {warned ? (
            <Stamp tone="stamp" size="sm" rotate={-3}>Advisory sent</Stamp>
          ) : (
            <StampButton tone="stamp" disabled={!forecast.warnHexes.length} onClick={() => warnCells(forecast.warnHexes, forecast.warnPlots)} className="min-h-10 w-full px-2">
              <span className="block text-center leading-tight">
                <span className="block whitespace-nowrap text-[13px] font-bold">{forecast.warnHexes.length ? `Warn ${forecast.warnPlots} ${forecast.warnPlots === 1 ? "plot" : "plots"}` : "Nobody to warn"}</span>
                {forecast.warnHexes.length ? <span className="block whitespace-nowrap text-[10.5px] opacity-90">{forecast.warnApp} app · {forecast.warnPlots - forecast.warnApp} SMS</span> : null}
              </span>
            </StampButton>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-wrap items-start gap-x-2 gap-y-1.5 overflow-y-auto px-4 pb-2 pt-1">
        {list.length === 0 ? (
          <p className="text-[12px] text-ink-3">
            Wet hours drive spread: rain splash and wind carry bacteria from reported cells. Try the demo rain to see what a storm would do.
          </p>
        ) : (
          list.map((v) => (
            <button
              key={v.village}
              type="button"
              onClick={() => selectHex(v.hexes.reduce((a, i) => (forecast.exposure[i] > forecast.exposure[a] ? i : a), v.hexes[0]))}
              className={cn("flex items-baseline gap-1.5 rounded-[2px] border px-2 py-1 text-left text-[12px] leading-tight hover:border-ink", v.tier >= 2 ? "border-stamp/60 bg-[color-mix(in_oklab,var(--stamp)_9%,var(--paper))]" : "border-ink/25")}
            >
              <span className="font-semibold">{geo.villages[v.village].name}</span>
              <span className={cn("label-form text-[9.5px]", v.tier >= 2 ? "text-stamp" : "text-ink-3")}>{TIER[v.tier]}</span>
              {v.peak >= 0 && <span className="typed text-[10.5px] text-ink-3">{frameLabel(frames[v.peak])}</span>}
              {v.warned > 0 && <span className="typed text-[10.5px] text-ink-2">{v.warned} {v.warned === 1 ? "plot" : "plots"}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
