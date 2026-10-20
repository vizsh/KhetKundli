import { geo } from "@/lib/geo";
import { dateOf, SEASON_DAYS } from "@/lib/sim/calendar";
import type { LonLat, Overrides, Season, WeatherDay } from "@/lib/sim/types";

/**
 * 72-hour spread forecast for bacterial blight (Xanthomonas axonopodis pv. punicae).
 * The pathogen moves between orchards mainly in wind-driven rain splash and on wet canopies, so each
 * forecast hour carries inoculum from reported cells downwind, weighted by how wet and warm that hour is.
 * Inputs are only what the desk can know: cells with reported scans, and the weather.
 */

/** Hourly forecast on a 3 × 3 grid across the taluka (Open-Meteo), as served by /api/weather/wind. */
export type WindGrid = {
  source: "live";
  points: LonLat[];
  times: string[];
  speed: number[][];
  from: number[][];
  rain: number[][];
  rh: number[][];
  temp: number[][];
  fetchedAt: string;
};

/** One forecast hour: wind towards (u east, v north, km/h) at each grid point, plus canopy weather. */
export type Frame = { day: number; hour: number; u: number[]; v: number[]; rain: number; rh: number; temp: number; demoRain?: boolean };
export type FrameSource = "live" | "recorded" | "simulated";

export const HORIZON = 72;
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export const frameLabel = (f: Frame) => `${DOW[dateOf(f.day).dow]} ${String(f.hour).padStart(2, "0")}:00`;

const toUV = (speed: number, from: number): [number, number] => {
  const r = (from * Math.PI) / 180;
  return [-speed * Math.sin(r), -speed * Math.cos(r)];
};

const isoHour = (day: number, hour: number) => {
  const { y, m, d } = dateOf(day);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
};

/** Hourly weather from a day's record: a dawn humidity peak, an afternoon temperature peak, rain in the evening. */
function syntheticHours(w: WeatherDay, day: number): Omit<Frame, "u" | "v">[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const c = Math.cos((2 * Math.PI * (hour - 5)) / 24);
    const rainy = w.rainMm > 0 && hour >= 15 && hour <= 20;
    return {
      day,
      hour,
      rain: rainy ? Math.round((w.rainMm / 6) * 10) / 10 : 0,
      rh: Math.max(20, Math.min(100, Math.round(w.rh + 16 * c + (rainy ? 10 : 0)))),
      temp: Math.round((w.tMin + (w.tMax - w.tMin) * (0.5 - 0.5 * c)) * 10) / 10,
    };
  });
}

/**
 * The 72 hours from the stamped hour. Live grid data when the clock is inside the forecast;
 * otherwise the season's own daily weather (recorded where the archive covers it), as one uniform wind.
 * A demo rain input is laid over the first hours of its day, so the desk can see what rain would do.
 */
export function framesFor(season: Season, t: number, wind: WindGrid | null, overrides: Overrides): { frames: Frame[]; source: FrameSource } {
  const day = Math.floor(t);
  const hour = Math.min(23, Math.floor((t - day) * 24));
  let frames: Frame[] = [];
  let source: FrameSource = "simulated";
  const start = wind ? wind.times.indexOf(isoHour(day, hour)) : -1;
  if (wind && start >= 0 && wind.times.length - start >= 48) {
    source = "live";
    for (let k = 0; k < HORIZON && start + k < wind.times.length; k++) {
      const i = start + k;
      const uv = wind.points.map((_, p) => toUV(wind.speed[p][i], wind.from[p][i]));
      const mean = (a: number[][]) => a.reduce((s, row) => s + row[i], 0) / a.length;
      frames.push({ day: day + Math.floor((hour + k) / 24), hour: (hour + k) % 24, u: uv.map((x) => x[0]), v: uv.map((x) => x[1]), rain: Math.round(mean(wind.rain) * 10) / 10, rh: Math.round(mean(wind.rh)), temp: Math.round(mean(wind.temp) * 10) / 10 });
    }
  } else {
    const days = [0, 1, 2, 3].map((k) => Math.min(SEASON_DAYS - 1, day + k));
    source = season.weather[day]?.observed ? "recorded" : "simulated";
    const hours = days.flatMap((d) => syntheticHours(season.weather[d], d).map((h) => ({ ...h, w: season.weather[d] })));
    frames = hours.slice(hour, hour + HORIZON).map(({ w, ...h }) => {
      // Daily maximum wind overstates the typical hour; 0.6 of it is closer to the hourly mean.
      const [u, v] = toUV(w.windKmh * 0.6, w.windFrom);
      return { ...h, u: [u], v: [v] };
    });
  }
  const demo = overrides.rain;
  if (demo) {
    frames = frames.map((f) => {
      if (f.day !== demo.day) return f;
      // Laid over the first six hours of its day. On non-live frames the engine has already put the
      // demo rain into that day's weather, so its evening share is removed to avoid counting it twice.
      const inWindow = f.hour < 6;
      if (!inWindow) return f.rain && source !== "live" ? { ...f, rain: 0 } : f;
      // A rain band arrives with a gust front: at least 14 km/h, keeping each point's direction.
      const gust = f.u.map((u, i) => {
        const speed = Math.hypot(u, f.v[i]);
        return speed > 0.5 ? [(u * Math.max(speed, 14)) / speed, (f.v[i] * Math.max(speed, 14)) / speed] : toUV(14, 270);
      });
      return { ...f, u: gust.map((g) => g[0]), v: gust.map((g) => g[1]), rain: Math.round((demo.mm / 6) * 10) / 10, rh: Math.max(f.rh, 92), demoRain: true };
    });
  }
  return { frames, source };
}

/** Bilinear wind at a point from a 3 × 3 grid (or the single uniform value). */
export function windAt(f: Frame, points: LonLat[] | null, at: LonLat): [number, number] {
  if (f.u.length === 1 || !points) return [f.u[0], f.v[0]];
  const [w, e, n, s] = [points[0][0], points[2][0], points[0][1], points[6][1]];
  const fx = Math.max(0, Math.min(2, ((at[0] - w) / (e - w)) * 2));
  const fy = Math.max(0, Math.min(2, ((n - at[1]) / (n - s)) * 2));
  const cx = Math.min(1, Math.floor(fx)), cy = Math.min(1, Math.floor(fy));
  const tx = fx - cx, ty = fy - cy;
  const at2 = (arr: number[], x: number, y: number) => arr[y * 3 + x];
  const lerp = (arr: number[]) =>
    (1 - ty) * ((1 - tx) * at2(arr, cx, cy) + tx * at2(arr, cx + 1, cy)) + ty * ((1 - tx) * at2(arr, cx, cy + 1) + tx * at2(arr, cx + 1, cy + 1));
  return [lerp(f.u), lerp(f.v)];
}

/** How much an hour favours spread: rain splash most, a wet canopy less, dry air not at all. */
export function favourOf(f: Frame) {
  const warm = f.temp >= 18 && f.temp <= 35 ? 1 : 0.4;
  if (f.rain >= 0.2) return Math.min(1, 0.6 + f.rain / 5) * warm;
  if (f.rh >= 90) return 0.45 * warm;
  if (f.rh >= 85) return 0.25 * warm;
  return 0;
}

export type Tier = 0 | 1 | 2 | 3;
export const TIER = ["Clear", "Low", "Moderate", "High"] as const;
export const TIER_MR = ["धोका नाही", "कमी", "मध्यम", "जास्त"] as const;

export type VillageExposure = { village: number; tier: Tier; exposure: number; peak: number; plots: number; warned: number; hexes: number[]; risk: number };

export type Forecast = {
  exposure: Float64Array;
  /** Exposure accumulated up to the end of each forecast hour, for scrubbing through the 72 hours. */
  cumulative: Float32Array[];
  tier: Tier[];
  /** Frame index of each cell's largest single-hour contribution, or -1. */
  peak: Int16Array;
  sources: number;
  wetHours: number;
  rainMm: number;
  villages: VillageExposure[];
  /** Cells to warn: moderate or high exposure, not already on warning. */
  warnHexes: number[];
  /** Plots in those cells: reached on the app, or by SMS. */
  warnPlots: number;
  warnApp: number;
};

/** Inoculum by reported level: watch (one or two scans in 14 days), warning, outbreak. */
const SOURCE_WEIGHT = [0, 0.5, 1.2, 2];
const KX = 111.32 * Math.cos((17.99 * Math.PI) / 180), KY = 110.57;
const XY = geo.hexes.map((h) => [h.center[0] * KX, h.center[1] * KY] as const);

export function spreadForecast(season: Season, day: number, frames: Frame[], points: LonLat[] | null): Forecast {
  const H = geo.hexes.length;
  const risk = season.hexRisk[day];
  const exposure = new Float64Array(H);
  const best = new Float64Array(H);
  const peak = new Int16Array(H).fill(-1);
  const sources = geo.hexes.flatMap((h, i) => (risk[i] ? [i] : []));
  let wetHours = 0, rainMm = 0, lastRain = -99;
  const cumulative: Float32Array[] = [];
  frames.forEach((f, k) => {
    rainMm += f.rain;
    if (k > 0) cumulative.push(Float32Array.from(exposure));
    if (f.rain >= 0.2) lastRain = k;
    // Leaves stay wet for a few hours after rain stops, and bacteria keep oozing onto them.
    const fav = Math.max(favourOf(f), k - lastRain <= 4 ? 0.45 * (f.temp >= 18 && f.temp <= 35 ? 1 : 0.4) : 0);
    if (!fav) return;
    wetHours += 1;
    for (const s of sources) {
      const [u, v] = windAt(f, points, geo.hexes[s].center);
      const speed = Math.hypot(u, v);
      const ux = speed ? u / speed : 0, uy = speed ? v / speed : 0;
      // Splash plus wind-driven rain: further reach in stronger wind.
      const reach = 0.8 + 0.12 * speed;
      for (let j = 0; j < H; j++) {
        if (j === s) continue;
        const dx = XY[j][0] - XY[s][0], dy = XY[j][1] - XY[s][1];
        const d = Math.hypot(dx, dy);
        if (d > 9) continue;
        const along = dx * ux + dy * uy;
        const cross = Math.abs(dx * uy - dy * ux);
        const sigma = 0.35 + 0.25 * Math.max(0, along);
        const kernel = along > 0 ? Math.exp(-along / reach) * Math.exp(-(cross * cross) / (2 * sigma * sigma)) : 0.35 * Math.exp(-d / 0.7);
        const c = SOURCE_WEIGHT[risk[s]] * fav * kernel;
        exposure[j] += c;
        if (c > best[j]) { best[j] = c; peak[j] = k; }
      }
    }
  });
  if (frames.length) cumulative.push(Float32Array.from(exposure));
  const tier = Array.from(exposure, (e) => (e >= 4 ? 3 : e >= 1.2 ? 2 : e >= 0.35 ? 1 : 0) as Tier);
  const warnHexes = geo.hexes.flatMap((_, i) => (tier[i] >= 2 && risk[i] < 2 ? [i] : []));
  const warnSet = new Set(warnHexes);
  const villages: VillageExposure[] = geo.villages.map((_, vi) => {
    const hexes = geo.hexes.flatMap((h, i) => (h.village === vi ? [i] : []));
    const top = hexes.reduce((a, i) => (exposure[i] > exposure[a] ? i : a), hexes[0] ?? 0);
    const plots = season.plots.filter((p) => p.village === vi);
    return {
      village: vi,
      tier: hexes.length ? (Math.max(...hexes.map((i) => (risk[i] >= 2 ? 0 : tier[i]))) as Tier) : 0,
      exposure: hexes.length ? exposure[top] : 0,
      peak: hexes.length ? peak[top] : -1,
      plots: plots.length,
      warned: plots.filter((p) => warnSet.has(p.hex)).length,
      hexes,
      risk: hexes.reduce((m, i) => Math.max(m, risk[i]), 0),
    };
  });
  villages.sort((a, b) => b.tier - a.tier || b.exposure - a.exposure || b.risk - a.risk);
  return {
    exposure,
    cumulative,
    tier,
    peak,
    sources: sources.length,
    wetHours,
    rainMm: Math.round(rainMm * 10) / 10,
    villages,
    warnHexes,
    warnPlots: season.plots.filter((p) => warnSet.has(p.hex)).length,
    warnApp: season.plots.filter((p) => warnSet.has(p.hex) && p.farmer.usesApp).length,
  };
}
