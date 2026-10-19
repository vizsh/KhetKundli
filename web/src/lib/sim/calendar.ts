// The season runs from 1 June 2026 (day 0) to 31 January 2027: one Mrig bahar crop.
export const SEASON_START = Date.UTC(2026, 5, 1);
export const SEASON_DAYS = 245;
/** Default demo day (19 October 2026); the app moves to the real date on load, see realToday(). */
export const TODAY = 140;
const DAY_MS = 86_400_000;

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
export const MONTHS_MR = ["जाने", "फेब्रु", "मार्च", "एप्रि", "मे", "जून", "जुलै", "ऑग", "सप्टें", "ऑक्टो", "नोव्हें", "डिसें"] as const;

export function dateOf(day: number) {
  const d = new Date(SEASON_START + day * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay() };
}

export function dayOf(y: number, m: number, d: number) {
  return Math.round((Date.UTC(y, m, d) - SEASON_START) / DAY_MS);
}

export function fmtDay(day: number) {
  const { d, m } = dateOf(day);
  return `${String(d).padStart(2, "0")} ${MONTHS[m]}`;
}

export function fmtDayLong(day: number) {
  const { d, m, y } = dateOf(day);
  return `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}/${y}`;
}

export const weekOf = (day: number) => Math.floor(day / 7);
export const weekStart = (week: number) => week * 7;

export const clampDay = (day: number) => Math.max(0, Math.min(SEASON_DAYS - 1, Math.round(day)));

/** The device's local date as a season day, clamped into the season. */
export function realToday() {
  const now = new Date();
  return clampDay(dayOf(now.getFullYear(), now.getMonth(), now.getDate()));
}
