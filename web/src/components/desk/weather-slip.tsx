"use client";

import { useEffect } from "react";
import { CloudRain, CloudSun, Sun } from "lucide-react";
import { SourceStamp } from "@/components/record/stamp";
import { dateOf, MONTHS } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import type { LiveDaily, LiveHourly } from "@/lib/sim/weather";

/** Fetches the live Open-Meteo forecast once and splices it into the season. */
export function LiveWeatherLoader() {
  const setLive = useDesk((s) => s.setLive);
  const syncToday = useDesk((s) => s.syncToday);
  useEffect(() => {
    syncToday();
    let cancelled = false;
    fetch("/api/weather")
      .then((r) => r.json())
      .then((j: { status: string; days: LiveDaily[]; hours?: LiveHourly[] }) => {
        if (!cancelled) setLive(j.days ?? [], j.hours ?? [], j.status === "live" && j.days?.length ? "live" : "unavailable");
      })
      .catch(() => !cancelled && setLive([], [], "unavailable"));
    return () => { cancelled = true; };
  }, [setLive, syncToday]);
  return null;
}

export function WeatherSlip() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const status = useDesk((s) => s.liveStatus);
  const day = Math.floor(t);
  const days = season.weather.slice(day, day + 4);
  const live = days[0]?.live === true;
  return (
    <div className="flex items-center gap-3 rounded-[2px] bg-paper px-3 py-1.5 shadow-[var(--shadow-sheet)]">
      <div className="flex flex-col items-start gap-1">
        <span className="label-form text-ink-2">Phaltan weather</span>
        <SourceStamp live={live} label={live ? "Open-Meteo forecast" : status === "loading" ? "Loading live forecast" : "Synthetic season weather"} />
      </div>
      <ol className="flex gap-3">
        {days.map((w, i) => {
          const { d, m } = dateOf(w.day);
          const Icon = w.rainMm >= 2 ? CloudRain : w.rainProb > 0.35 ? CloudSun : Sun;
          return (
            <li key={w.day} className={i > 1 ? "hidden flex-col items-center text-center sm:flex" : "flex flex-col items-center text-center"}>
              <span className="typed text-[10px] text-ink-3">{d} {MONTHS[m]}</span>
              <Icon className={w.rainMm >= 2 ? "size-4 text-water" : "size-4 text-ink-2"} strokeWidth={1.75} aria-hidden />
              <span className="typed text-[11px] leading-tight">{w.rainMm >= 0.5 ? `${w.rainMm.toFixed(0)}mm` : `${Math.round(w.tMax)}°`}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
