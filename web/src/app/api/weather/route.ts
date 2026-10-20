import { cacheLife } from "next/cache";
import type { LiveDaily, LiveHourly } from "@/lib/sim/weather";

const PHALTAN = { lat: 17.99, lon: 74.43 };
const SEASON_START = "2026-06-01";
const SEASON_END = "2027-01-31";
const DAILY = [
  "precipitation_sum",
  "temperature_2m_max",
  "temperature_2m_min",
  "relative_humidity_2m_mean",
  "wind_speed_10m_max",
  "wind_direction_10m_dominant",
  "et0_fao_evapotranspiration",
];
const HOURLY_WET = ["temperature_2m", "relative_humidity_2m", "precipitation"];

type Daily = {
  time: string[];
  precipitation_sum: (number | null)[];
  precipitation_probability_max?: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  relative_humidity_2m_mean: (number | null)[];
  wind_speed_10m_max: (number | null)[];
  wind_direction_10m_dominant: (number | null)[];
  et0_fao_evapotranspiration: (number | null)[];
};
type Hourly = {
  time: string[];
  temperature_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  precipitation: (number | null)[];
  precipitation_probability?: (number | null)[];
  wind_speed_10m?: (number | null)[];
};

/**
 * Leaf-wetness hours by day: hours warm enough for bacterial blight (18 to 35 °C) with the canopy
 * wet, from rain or from relative humidity at or above 85%.
 */
function wetHoursByDay(h: Hourly) {
  const out = new Map<string, number>();
  h.time.forEach((t, i) => {
    const d = t.slice(0, 10);
    const T = h.temperature_2m[i] ?? 0, rh = h.relative_humidity_2m[i] ?? 0, p = h.precipitation[i] ?? 0;
    out.set(d, (out.get(d) ?? 0) + (T >= 18 && T <= 35 && (rh >= 85 || p >= 0.2) ? 1 : 0));
  });
  return out;
}

function toDays(daily: Daily, wet: Map<string, number>, observed: boolean): LiveDaily[] {
  return daily.time.flatMap((date, i) => {
    if (daily.precipitation_sum[i] === null || daily.temperature_2m_max[i] === null) return [];
    const rainMm = daily.precipitation_sum[i] ?? 0;
    const prob = daily.precipitation_probability_max?.[i];
    return [{
      date,
      rainMm,
      // Recorded days have no forecast probability: rain either fell or it did not.
      rainProb: prob !== undefined && prob !== null ? prob / 100 : rainMm >= 1 ? 0.9 : rainMm > 0 ? 0.4 : 0.05,
      tMax: daily.temperature_2m_max[i] ?? 0,
      tMin: daily.temperature_2m_min[i] ?? 0,
      rh: Math.round(daily.relative_humidity_2m_mean[i] ?? 0),
      windKmh: Math.round(daily.wind_speed_10m_max[i] ?? 0),
      windFrom: Math.round(daily.wind_direction_10m_dominant[i] ?? 0),
      et0: daily.et0_fao_evapotranspiration[i] ?? 0,
      wetHours: wet.get(date),
      observed,
    }];
  });
}

/** Today's date in Phaltan (IST), as YYYY-MM-DD. */
const istDate = (offsetDays = 0) => new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function forecast(): Promise<{ days: LiveDaily[]; hours: LiveHourly[]; fetchedAt: string }> {
  "use cache";
  cacheLife("hours");
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(PHALTAN.lat),
    longitude: String(PHALTAN.lon),
    daily: [...DAILY, "precipitation_probability_max"].join(","),
    hourly: ["precipitation_probability", "precipitation", "wind_speed_10m", "temperature_2m", "relative_humidity_2m"].join(","),
    forecast_days: "7",
    timezone: "Asia/Kolkata",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const { daily, hourly } = (await res.json()) as { daily: Daily; hourly: Hourly };
  const days = toDays(daily, wetHoursByDay(hourly), false);
  const hours = hourly.time.map((time, i) => ({
    time,
    rainProb: (hourly.precipitation_probability?.[i] ?? 0) / 100,
    rainMm: hourly.precipitation[i] ?? 0,
    windKmh: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
    tempC: hourly.temperature_2m[i] ?? 0,
    rh: Math.round(hourly.relative_humidity_2m[i] ?? 0),
  }));
  return { days, hours, fetchedAt: new Date().toISOString() };
}

/** The season so far as it was recorded (ERA5-based reanalysis from Open-Meteo's archive). */
async function recorded(): Promise<LiveDaily[]> {
  "use cache";
  cacheLife("hours");
  const end = [istDate(-1), SEASON_END].sort()[0];
  if (end < SEASON_START) return [];
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.search = new URLSearchParams({
    latitude: String(PHALTAN.lat),
    longitude: String(PHALTAN.lon),
    start_date: SEASON_START,
    end_date: end,
    daily: DAILY.join(","),
    hourly: HOURLY_WET.join(","),
    timezone: "Asia/Kolkata",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo archive responded ${res.status}`);
  const { daily, hourly } = (await res.json()) as { daily: Daily; hourly: Hourly };
  return toDays(daily, wetHoursByDay(hourly), true);
}

export async function GET() {
  const [now, past] = await Promise.allSettled([forecast(), recorded()]);
  if (now.status === "rejected") {
    return Response.json({ source: "Open-Meteo", status: "unavailable", days: past.status === "fulfilled" ? past.value : [], hours: [], error: String(now.reason) });
  }
  // Forecast days win where the two overlap: the archive lags by a day or two.
  const ahead = new Set(now.value.days.map((d) => d.date));
  const history = past.status === "fulfilled" ? past.value.filter((d) => !ahead.has(d.date)) : [];
  return Response.json({
    source: "Open-Meteo",
    status: "live",
    ...now.value,
    days: [...history, ...now.value.days],
    recordedThrough: history.at(-1)?.date ?? null,
    archive: past.status === "fulfilled" ? "ok" : "unavailable",
  });
}
