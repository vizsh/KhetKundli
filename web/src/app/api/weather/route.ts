import { cacheLife } from "next/cache";
import type { LiveDaily, LiveHourly } from "@/lib/sim/weather";

const PHALTAN = { lat: 17.99, lon: 74.43 };

type OpenMeteo = {
  daily: {
    time: string[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    relative_humidity_2m_mean: number[];
    wind_speed_10m_max: number[];
    wind_direction_10m_dominant: number[];
    et0_fao_evapotranspiration: number[];
  };
  hourly: {
    time: string[];
    precipitation_probability: (number | null)[];
    precipitation: number[];
    wind_speed_10m: number[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
  };
};

async function forecast(): Promise<{ days: LiveDaily[]; hours: LiveHourly[]; fetchedAt: string }> {
  "use cache";
  cacheLife("hours");
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(PHALTAN.lat),
    longitude: String(PHALTAN.lon),
    daily: [
      "precipitation_sum",
      "precipitation_probability_max",
      "temperature_2m_max",
      "temperature_2m_min",
      "relative_humidity_2m_mean",
      "wind_speed_10m_max",
      "wind_direction_10m_dominant",
      "et0_fao_evapotranspiration",
    ].join(","),
    hourly: ["precipitation_probability", "precipitation", "wind_speed_10m", "temperature_2m", "relative_humidity_2m"].join(","),
    forecast_days: "7",
    timezone: "Asia/Kolkata",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const { daily, hourly } = (await res.json()) as OpenMeteo;
  const days = daily.time.map((date, i) => ({
    date,
    rainMm: daily.precipitation_sum[i] ?? 0,
    rainProb: (daily.precipitation_probability_max[i] ?? 0) / 100,
    tMax: daily.temperature_2m_max[i],
    tMin: daily.temperature_2m_min[i],
    rh: Math.round(daily.relative_humidity_2m_mean[i]),
    windKmh: Math.round(daily.wind_speed_10m_max[i]),
    windFrom: Math.round(daily.wind_direction_10m_dominant[i]),
    et0: daily.et0_fao_evapotranspiration[i],
  }));
  const hours = hourly.time.map((time, i) => ({
    time,
    rainProb: (hourly.precipitation_probability[i] ?? 0) / 100,
    rainMm: hourly.precipitation[i] ?? 0,
    windKmh: Math.round(hourly.wind_speed_10m[i]),
    tempC: hourly.temperature_2m[i],
    rh: Math.round(hourly.relative_humidity_2m[i]),
  }));
  return { days, hours, fetchedAt: new Date().toISOString() };
}

export async function GET() {
  try {
    const data = await forecast();
    return Response.json({ source: "Open-Meteo", status: "live", ...data });
  } catch (err) {
    return Response.json({ source: "Open-Meteo", status: "unavailable", days: [], hours: [], error: String(err) });
  }
}
