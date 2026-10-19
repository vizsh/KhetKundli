import { dateOf, fmtDay, MONTHS, MONTHS_MR, SEASON_DAYS } from "@/lib/sim/calendar";
import { SPRAYS } from "@/lib/sim/rules";
import type { PlotEvent, Season, WeatherDay } from "@/lib/sim/types";
import type { LiveHourly } from "@/lib/sim/weather";

const DEV = "०१२३४५६७८९";
/** Western digits to Devanagari digits, for Marathi lines. */
export const mrNum = (s: string | number) => String(s).replace(/[0-9]/g, (d) => DEV[Number(d)]);

export function mrDay(day: number) {
  const { d, m } = dateOf(day);
  return `${mrNum(d)} ${MONTHS_MR[m]}`;
}

function when(day: number, today: number) {
  if (day === today) return { en: "today", mr: "आज" };
  if (day === today + 1) return { en: "tomorrow", mr: "उद्या" };
  return { en: `on ${fmtDay(day)}`, mr: `${mrDay(day)} रोजी` };
}

const ORDINAL_MR: Record<number, string> = { 1: "पहिली", 2: "दुसरी", 3: "तिसरी", 4: "चौथी" };

export type TodayAction = {
  kind: "spray" | "irrigate" | "skip" | "pick" | "watch" | "calm";
  en: string;
  mr: string;
  detail?: string;
  detailMr?: string;
  tone: "act" | "alert" | "calm";
  day?: number;
};

/** The single thing the farmer should do, from her own plot record. */
export function todayAction(s: Season, plot: number, day: number): TodayAction {
  const events = s.eventsByPlot[plot];
  const upcoming = events.filter((e) => e.day >= day && e.day <= day + 3);
  const spray = upcoming.find((e): e is Extract<PlotEvent, { type: "spray" }> => e.type === "spray" && !e.washedOff);
  if (spray) {
    const w = when(spray.day, day);
    const curative = spray.product.startsWith("Copper");
    const spec = curative ? SPRAYS.curative : SPRAYS.preventive;
    return {
      kind: "spray",
      tone: curative ? "alert" : "act",
      day: spray.day,
      en: `Spray ${w.en} at 06:00`,
      mr: `${w.mr} सकाळी ${mrNum(6)} वाजता फवारणी करा`,
      detail: `${spec.product}, ${spec.dose}`,
      detailMr: `${spec.mr}, ${mrNum(spec.dose.replace(" per litre", ""))} प्रति लिटर`,
    };
  }
  const water = events.find((e) => e.day === day && (e.type === "irrigate" || e.type === "irrigate-skip"));
  if (water?.type === "irrigate-skip") {
    const mm = s.weather[day + 1]?.rainMm ?? 0;
    return {
      kind: "skip",
      tone: "act",
      en: "Skip irrigation today",
      mr: "आज पाणी देऊ नका",
      detail: `${mm.toFixed(0)} mm rain forecast tomorrow; ${(water.litresSaved / 1000).toFixed(0)} kL stays in the ground`,
      detailMr: `उद्या ${mrNum(mm.toFixed(0))} मिमी पावसाचा अंदाज; ${mrNum((water.litresSaved / 1000).toFixed(0))} हजार लिटर पाणी वाचेल`,
    };
  }
  if (water?.type === "irrigate") {
    return {
      kind: "irrigate",
      tone: "act",
      en: "Irrigate today",
      mr: "आज पाणी द्या",
      detail: `${(water.litres / 1000).toFixed(0)} kL by drip, morning`,
      detailMr: `ठिबकने ${mrNum((water.litres / 1000).toFixed(0))} हजार लिटर, सकाळी`,
    };
  }
  const pick = upcoming.find((e): e is Extract<PlotEvent, { type: "pick" }> => e.type === "pick");
  if (pick) {
    const w = when(pick.day, day);
    return {
      kind: "pick",
      tone: "act",
      day: pick.day,
      en: `Picking ${pick.picking} ${w.en}`,
      mr: `${w.mr} ${ORDINAL_MR[pick.picking] ?? mrNum(pick.picking)} तोडणी`,
      detail: `About ${pick.crates} crates, grade ${pick.grade}. Pooled run leaves the collection point at 05:15.`,
      detailMr: `सुमारे ${mrNum(pick.crates)} क्रेट. सामायिक गाडी सकाळी ${mrNum("05:15")} ला निघेल.`,
    };
  }
  const risk = s.hexRisk[day]?.[s.plots[plot].hex] ?? 0;
  if (risk >= 1) {
    return {
      kind: "watch",
      tone: "alert",
      en: "Blight reported near you",
      mr: "जवळपास तेल्या रोग आढळला आहे",
      detail: "Check leaves and fruit for oily spots; scan any you find.",
      detailMr: "पाने आणि फळांवर तेलकट डाग तपासा; दिसल्यास स्कॅन करा.",
    };
  }
  const next = events.find((e) => e.day > day && e.type === "irrigate");
  return {
    kind: "calm",
    tone: "calm",
    en: "Nothing urgent today",
    mr: "आज तातडीचे काम नाही",
    detail: next ? `Next irrigation ${fmtDay(next.day)}.` : undefined,
    detailMr: next ? `पुढचे पाणी ${mrDay(next.day)} रोजी.` : undefined,
  };
}

export type HourCell = { label: string; hour: number; ok: "good" | "fair" | "bad"; rainProb: number; windKmh: number; tempC: number };

/**
 * 72 hours of spray suitability. Live hourly forecast when the stamped day is today,
 * otherwise derived from the simulated daily weather.
 */
export function sprayRibbon(weather: WeatherDay[], day: number, hourly: LiveHourly[], isToday: boolean): { cells: HourCell[]; live: boolean } {
  const judge = (rainProb: number, rainMm: number, wind: number, temp: number, hour: number): HourCell["ok"] => {
    const daylight = hour >= 6 && hour <= 18;
    const cool = (hour >= 6 && hour <= 10) || (hour >= 16 && hour <= 18);
    if (!daylight || rainMm >= 0.5 || rainProb >= 0.5 || wind >= 18 || temp >= 36) return "bad";
    if (rainProb < 0.3 && wind < 12 && cool) return "good";
    return "fair";
  };
  if (isToday && hourly.length) {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowIdx = Math.max(0, hourly.findIndex((h) => h.time.slice(0, 10) === localDate && Number(h.time.slice(11, 13)) >= now.getHours()));
    const cells = hourly.slice(nowIdx, nowIdx + 72).map((h) => {
      const hour = Number(h.time.slice(11, 13));
      const [date, time] = h.time.split("T");
      const [, mo, dd] = date.split("-").map(Number);
      return { label: `${String(dd).padStart(2, "0")} ${MONTHS[mo - 1]} ${time}`, hour, ok: judge(h.rainProb, h.rainMm, h.windKmh, h.tempC, hour), rainProb: h.rainProb, windKmh: h.windKmh, tempC: h.tempC };
    });
    return { cells, live: true };
  }
  const cells: HourCell[] = [];
  for (let k = 0; k < 72; k++) {
    const d = Math.min(SEASON_DAYS - 1, day + Math.floor((6 + k) / 24));
    const hour = (6 + k) % 24;
    const w = weather[d];
    const rainy = w.rainMm >= 1 && hour >= 14;
    const temp = w.tMin + (w.tMax - w.tMin) * Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    cells.push({ label: `${fmtDay(d)} ${String(hour).padStart(2, "0")}:00`, hour, ok: judge(rainy ? 0.8 : w.rainProb * 0.6, rainy ? w.rainMm / 6 : 0, w.windKmh, temp, hour), rainProb: w.rainProb, windKmh: w.windKmh, tempC: Math.round(temp) });
  }
  return { cells, live: false };
}

export function bestWindow(cells: HourCell[]) {
  for (let i = 0; i < cells.length - 1; i++) {
    if (cells[i].ok === "good" && cells[i + 1].ok === "good") {
      let j = i + 1;
      while (j + 1 < cells.length && cells[j + 1].ok === "good" && j - i < 3) j++;
      return { start: i, end: j };
    }
  }
  return null;
}
