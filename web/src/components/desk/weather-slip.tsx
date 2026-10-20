"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CloudRain, CloudSun, Sun } from "lucide-react";
import { SourceStamp } from "@/components/record/stamp";
import { dateOf, MONTHS } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import type { LiveDaily, LiveHourly } from "@/lib/sim/weather";

/** When the forecast came from the saved snapshot (offline mode), the time it was saved. */
let snapshotAt: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useSnapshotAt = () => useSyncExternalStore(subscribe, () => snapshotAt, () => null);

/** Fetches the live Open-Meteo forecast once and splices it into the season. */
export function LiveWeatherLoader() {
  const setLive = useDesk((s) => s.setLive);
  const syncToday = useDesk((s) => s.syncToday);
  useEffect(() => {
    syncToday();
    let cancelled = false;
    fetch("/api/weather")
      .then((r) => r.json())
      .then((j: { status: string; days: LiveDaily[]; hours?: LiveHourly[]; snapshotAt?: string }) => {
        if (cancelled) return;
        snapshotAt = j.snapshotAt ?? null;
        listeners.forEach((fn) => fn());
        setLive(j.days ?? [], j.hours ?? [], j.status === "live" && j.days?.length ? "live" : "unavailable");
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
  const saved = useSnapshotAt();
  const day = Math.floor(t);
  const days = season.weather.slice(day, day + 4);
  const live = days[0]?.live === true && !days[0]?.observed;
  const recorded = days[0]?.observed === true;
  return (
    <div className="flex items-center gap-3 rounded-[2px] bg-paper px-3 py-1.5 shadow-[var(--shadow-sheet)]">
      <div className="flex flex-col items-start gap-1">
        <span className="label-form text-ink-2">Phaltan weather</span>
        <SourceStamp live={live} recorded={recorded} label={live ? (saved ? `Open-Meteo forecast saved ${new Date(saved).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} (offline mode)` : "Open-Meteo forecast") : recorded ? "Recorded weather, Open-Meteo archive" : status === "loading" ? "Loading live forecast" : "Synthetic season weather"} />
        {saved && <span className="typed text-[10px] leading-none text-alert">saved forecast · offline</span>}
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
