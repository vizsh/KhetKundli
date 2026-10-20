import { cacheLife } from "next/cache";
import { geo } from "@/lib/geo";
import type { WindGrid } from "@/lib/spread";

/** A 3 × 3 grid of forecast points across the taluka's bounding box, west to east, north to south. */
function gridPoints(): [number, number][] {
  const lons = geo.boundary.map((p) => p[0]), lats = geo.boundary.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const f = [1 / 6, 1 / 2, 5 / 6];
  return f.flatMap((fy) => f.map((fx) => [Math.round((x0 + (x1 - x0) * fx) * 1e4) / 1e4, Math.round((y1 - (y1 - y0) * fy) * 1e4) / 1e4] as [number, number]));
}

type Point = { hourly: { time: string[]; wind_speed_10m: number[]; wind_direction_10m: number[]; precipitation: number[]; relative_humidity_2m: number[]; temperature_2m: number[] } };

async function windGrid(): Promise<WindGrid> {
  "use cache";
  cacheLife("hours");
  const points = gridPoints();
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: points.map((p) => p[1]).join(","),
    longitude: points.map((p) => p[0]).join(","),
    hourly: "wind_speed_10m,wind_direction_10m,precipitation,relative_humidity_2m,temperature_2m",
    forecast_days: "4",
    timezone: "Asia/Kolkata",
  }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const body = (await res.json()) as Point[] | Point;
  const list = Array.isArray(body) ? body : [body];
  const round = (v: number | null | undefined) => Math.round((v ?? 0) * 10) / 10;
  return {
    source: "live",
    points,
    times: list[0].hourly.time,
    speed: list.map((p) => p.hourly.wind_speed_10m.map(round)),
    from: list.map((p) => p.hourly.wind_direction_10m.map((v) => Math.round(v ?? 0))),
    rain: list.map((p) => p.hourly.precipitation.map(round)),
    rh: list.map((p) => p.hourly.relative_humidity_2m.map((v) => Math.round(v ?? 0))),
    temp: list.map((p) => p.hourly.temperature_2m.map(round)),
    fetchedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    return Response.json({ status: "live", ...(await windGrid()) });
  } catch (err) {
    return Response.json({ status: "unavailable", error: String(err) });
  }
}
