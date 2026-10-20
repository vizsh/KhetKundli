import { cacheLife } from "next/cache";
import type { Ensemble } from "@/lib/spread";

const PHALTAN = { lat: 17.99, lon: 74.43 };
const MODEL = "ecmwf_ifs025";

type Body = { hourly: Record<string, (number | null)[]> & { time: string[] } };

/** The ECMWF ensemble (control + 50 members) at Phaltan, hourly for four days: the forecast's spread of possibilities. */
async function ensemble(): Promise<Ensemble> {
  "use cache";
  cacheLife("hours");
  const url = new URL("https://ensemble-api.open-meteo.com/v1/ensemble");
  url.search = new URLSearchParams({
    latitude: String(PHALTAN.lat),
    longitude: String(PHALTAN.lon),
    hourly: "precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m",
    models: MODEL,
    forecast_days: "4",
    timezone: "Asia/Kolkata",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ensemble responded ${res.status}`);
  const { hourly } = (await res.json()) as Body;
  // Keys are "precipitation" (control) and "precipitation_member01" … "_member50".
  const suffixes = ["", ...Object.keys(hourly).filter((k) => k.startsWith("precipitation_member")).map((k) => k.slice("precipitation".length))];
  const col = (name: string, sfx: string, digits = 1) => (hourly[`${name}${sfx}`] ?? []).map((v) => Math.round((v ?? 0) * 10 ** digits) / 10 ** digits);
  return {
    model: "ECMWF IFS 0.25° ensemble",
    times: hourly.time,
    members: suffixes.map((s) => ({
      rain: col("precipitation", s),
      speed: col("wind_speed_10m", s),
      from: col("wind_direction_10m", s, 0),
      rh: col("relative_humidity_2m", s, 0),
    })),
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    return Response.json({ status: "live", ...(await ensemble()) });
  } catch (err) {
    return Response.json({ status: "unavailable", error: String(err) });
  }
}
