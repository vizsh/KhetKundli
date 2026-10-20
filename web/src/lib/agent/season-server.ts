import { generateSeason } from "@/lib/sim/season";
import type { Overrides, Season } from "@/lib/sim/types";
import type { LiveDaily } from "@/lib/sim/weather";

/**
 * The season on the server: the same engine the browsers run, on the same recorded and forecast
 * weather (read from this app's own /api/weather) and the overrides the phone sends, so the agent
 * reasons over exactly what the farmer sees.
 */
let weather: { at: number; days: LiveDaily[] } | null = null;
const seasons = new Map<string, Season>();

export async function liveDays(origin: string): Promise<LiveDaily[]> {
  if (weather && Date.now() - weather.at < 10 * 60_000) return weather.days;
  try {
    const res = await fetch(`${origin}/api/weather`);
    const j = (await res.json()) as { days?: LiveDaily[] };
    weather = { at: Date.now(), days: j.days ?? [] };
  } catch {
    weather = { at: Date.now(), days: weather?.days ?? [] };
  }
  return weather.days;
}

export async function seasonFor(origin: string, overrides: Overrides = {}): Promise<Season> {
  const live = await liveDays(origin);
  const key = `${live.length}:${live.at(-1)?.date}:${JSON.stringify(overrides)}`;
  let s = seasons.get(key);
  if (!s) {
    s = generateSeason({ overrides, live });
    seasons.set(key, s);
    if (seasons.size > 8) seasons.delete(seasons.keys().next().value!);
  }
  return s;
}
