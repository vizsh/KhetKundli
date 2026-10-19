import { dateOf, SEASON_DAYS } from "./calendar";
import type { Rng } from "./rng";
import type { WeatherDay } from "./types";

// Monthly climatology for the Phaltan rain shadow (index = calendar month 0-11).
// Values are approximate normals used to generate a plausible synthetic season.
const RAIN_P = [0.02, 0.02, 0.03, 0.05, 0.12, 0.34, 0.42, 0.38, 0.42, 0.26, 0.08, 0.03];
const RAIN_MEAN = [3, 3, 4, 6, 9, 8, 6, 6, 10, 10, 6, 4];
const T_MAX = [29.5, 32, 35.5, 37.5, 37, 31.5, 28, 27.5, 29, 30.5, 29.5, 28.5];
const T_MIN = [12.5, 14, 17.5, 20.5, 22, 23, 22, 21.5, 21, 19, 15.5, 12.5];
const RH = [47, 42, 38, 40, 52, 74, 81, 82, 79, 70, 58, 51];
const ET0 = [3.8, 4.6, 5.6, 6.4, 6.6, 5.0, 4.0, 3.8, 4.0, 4.2, 3.8, 3.5];
const WIND = [7, 8, 9, 10, 13, 16, 18, 16, 11, 8, 7, 7];
const WIND_FROM = [70, 80, 270, 270, 260, 245, 250, 255, 260, 90, 70, 65];

export function generateWeather(rng: Rng): WeatherDay[] {
  const days: WeatherDay[] = [];
  let wetSpell = 0;
  for (let day = 0; day < SEASON_DAYS; day++) {
    const { m } = dateOf(day);
    const persistence = wetSpell > 0 ? 1.35 : 0.9;
    const pRain = Math.min(0.85, RAIN_P[m] * persistence);
    const raining = rng.chance(pRain);
    wetSpell = raining ? wetSpell + 1 : 0;
    const rainMm = raining ? Math.round(-Math.log(1 - rng.next()) * RAIN_MEAN[m] * 10) / 10 : 0;
    const rh = Math.min(98, Math.max(25, RH[m] + rng.normal(0, 5) + (raining ? 9 : 0)));
    const tMax = Math.round((T_MAX[m] + rng.normal(0, 1.4) - (raining ? 2 : 0)) * 10) / 10;
    const tMin = Math.round((T_MIN[m] + rng.normal(0, 1.1)) * 10) / 10;
    days.push({
      day,
      rainMm,
      rainProb: Math.min(0.95, Math.max(0.02, pRain + (raining ? 0.35 : -0.1) + rng.normal(0, 0.06))),
      tMax,
      tMin,
      rh: Math.round(rh),
      windKmh: Math.max(2, Math.round(WIND[m] + rng.normal(0, 3))),
      windFrom: Math.round((WIND_FROM[m] + rng.normal(0, 25) + 360) % 360),
      et0: Math.round(Math.max(1.5, ET0[m] + rng.normal(0, 0.5) - (raining ? 1.2 : 0)) * 10) / 10,
    });
  }
  return days;
}

export type LiveHourly = {
  time: string; // local ISO, Asia/Kolkata
  rainProb: number;
  rainMm: number;
  windKmh: number;
  tempC: number;
  rh: number;
};

export type LiveDaily = {
  date: string;
  rainMm: number;
  rainProb: number;
  tMax: number;
  tMin: number;
  rh: number;
  windKmh: number;
  windFrom: number;
  et0: number;
};
