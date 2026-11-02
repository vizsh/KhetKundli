import { geo } from "@/lib/geo";
import { fmtDay, SEASON_DAYS, weekOf } from "./calendar";
import { stageOn } from "./rules";
import type { PlotEvent, Season } from "./types";

export function riskCounts(s: Season, day: number) {
  const out = [0, 0, 0, 0];
  s.hexRisk[day].forEach((r) => (out[r] += 1));
  return out;
}

export function recentDetections(s: Season, day: number, window = 14) {
  let n = 0;
  for (let d = Math.max(0, day - window + 1); d <= day; d++) {
    for (const e of s.eventsByDay[d]) if (e.type === "scan" && e.finding === "bacterial-blight") n++;
  }
  return n;
}

export function weekTotals(s: Season) {
  return s.harvestByWeek.map((w) => w.reduce((a, b) => a + b, 0));
}

export function lastPickOf(s: Season, plot: number) {
  const p = s.plots[plot];
  return p.harvestStart + 25;
}

export function stageOf(s: Season, plot: number, day: number) {
  const p = s.plots[plot];
  return stageOn(day, p.baharStart, p.harvestStart, lastPickOf(s, plot));
}

export type RegisterLine = {
  key: string;
  hour: number;
  by: PlotEvent["by"];
  plot?: number;
  text: string;
  alert?: boolean;
  count?: number;
};

/** The day's register: notable entries in full, routine irrigation folded into one line. */
export function registerFor(s: Season, day: number): RegisterLine[] {
  const lines: RegisterLine[] = [];
  let irrigated = 0, litres = 0, skipped = 0, saved = 0, picks = 0, crates = 0;
  for (const e of s.eventsByDay[day] ?? []) {
    const p = s.plots[e.plot];
    const who = `${p.id}`;
    switch (e.type) {
      case "irrigate": irrigated++; litres += e.litres; break;
      case "irrigate-skip": skipped++; saved += e.litresSaved; break;
      case "pick": picks++; crates += e.crates; break;
      case "scan":
        lines.push({
          key: e.id, hour: e.hour, by: e.by, plot: e.plot, alert: e.finding === "bacterial-blight",
          text: e.finding === "bacterial-blight"
            ? `${who} leaf scan: bacterial blight, ${Math.round(e.confidence * 100)}% confidence${e.offline ? ", scanned offline" : ""}`
            : `${who} leaf scan: no disease found`,
        });
        break;
      case "spray":
        lines.push({ key: e.id, hour: e.hour, by: e.by, plot: e.plot, alert: e.washedOff, text: `${who} sprayed ${e.product}${e.washedOff ? ", washed off by rain" : ""}` });
        break;
      case "advisory":
        if (e.text.startsWith("Bacterial blight") || e.text.startsWith("Rain")) lines.push({ key: e.id, hour: e.hour, by: e.by, plot: e.plot, text: `${who}: ${e.text}` });
        break;
      case "voice":
        lines.push({ key: e.id, hour: e.hour, by: e.by, plot: e.plot, text: `${who} asked: "${e.question}"` });
        break;
      case "bahar":
        lines.push({ key: e.id, hour: e.hour, by: e.by, plot: e.plot, text: `${who} bahar regulated` });
        break;
      case "sale":
        if (e.slip) lines.push({ key: e.id, hour: e.hour, by: e.by, plot: e.plot, alert: e.slip.aboveCard > 0, text: `${who} checked a sale slip on the phone: ${e.slip.aboveCard > 0 ? `₹${e.slip.aboveCard.toLocaleString("en-IN")} charged above the rate card` : "every deduction as agreed"}` });
        break;
      case "booking":
        break;
    }
  }
  const officer = (s.eventsByDay[day] ?? []).filter((e) => e.type === "advisory" && e.text.startsWith("Officer advisory")).length;
  if (officer) lines.push({ key: `o${day}`, hour: 8, by: "computed", text: `Officer's preventive advisory from the spread forecast sent to ${officer} plots`, count: officer });
  const warnings = (s.eventsByDay[day] ?? []).filter((e) => e.type === "advisory" && e.text.startsWith("Blight confirmed")).length;
  if (warnings) lines.push({ key: `w${day}`, hour: 10, by: "computed", text: `Neighbour warnings sent to ${warnings} plots near confirmed blight`, count: warnings });
  if (irrigated) lines.push({ key: `i${day}`, hour: 7, by: "human", text: `Irrigation logged on ${irrigated} plots, ${(litres / 1e6).toFixed(2)} ML`, count: irrigated });
  if (skipped) lines.push({ key: `k${day}`, hour: 7, by: "human", text: `Irrigation skipped on ${skipped} plots for forecast rain, ${(saved / 1e6).toFixed(2)} ML saved`, count: skipped });
  if (picks) lines.push({ key: `p${day}`, hour: 8, by: "human", text: `${picks} pickings, ${crates.toLocaleString("en-IN")} crates`, count: picks });
  const runs = s.runsByDay[day] ?? [];
  if (runs.length) {
    const c = runs.reduce((a, r) => a + r.crates, 0);
    lines.push({ key: `r${day}`, hour: 5.25, by: "computed", text: `${runs.length} pooled runs, ${c.toLocaleString("en-IN")} crates, ${Math.round((c / (runs.length * 75)) * 100)}% full` });
  }
  const sales = (s.eventsByDay[day] ?? []).filter((e) => e.type === "sale");
  if (sales.length) {
    const net = sales.reduce((a, e) => a + (e.type === "sale" ? e.net : 0), 0);
    lines.push({ key: `s${day}`, hour: 8, by: "verified", text: `${sales.length} sale slips read and settled, ₹${Math.round(net).toLocaleString("en-IN")} net to farmers` });
  }
  return lines.sort((a, b) => a.hour - b.hour);
}

export function plotHistory(s: Season, plot: number, day: number) {
  return s.eventsByPlot[plot].filter((e) => e.day <= day && e.type !== "irrigate");
}

export function blightStatus(s: Season, plot: number, day: number) {
  const known = s.eventsByPlot[plot].some((e) => e.day <= day && e.type === "scan" && e.finding === "bacterial-blight");
  const treated = s.eventsByPlot[plot].some((e) => e.day <= day && e.type === "spray" && !e.washedOff && e.product.startsWith("Copper"));
  if (treated) return { label: "Blight, treated", tone: "stamp" as const };
  if (known) return { label: "Blight confirmed", tone: "alert" as const };
  const risk = s.hexRisk[day][s.plots[plot].hex];
  if (risk >= 2) return { label: "Blight warning in area", tone: "alert" as const };
  if (risk === 1) return { label: "Blight watch in area", tone: "ink" as const };
  return { label: "No blight reported", tone: "ink" as const };
}

export function villageCrates(s: Season, week: number) {
  return s.harvestByWeek[Math.max(0, Math.min(s.harvestByWeek.length - 1, week))] ?? geo.villages.map(() => 0);
}

export function waterShareByVillage(s: Season, day: number) {
  const faced = geo.villages.map(() => 0);
  const followed = geo.villages.map(() => 0);
  for (let d = Math.max(0, day - 20); d <= day; d++) {
    for (const e of s.eventsByDay[d]) {
      if (e.type === "irrigate-skip") { faced[s.plots[e.plot].village]++; followed[s.plots[e.plot].village]++; }
    }
  }
  const saved = geo.villages.map(() => 0);
  for (let d = 0; d <= day; d++) for (const e of s.eventsByDay[d]) if (e.type === "irrigate-skip") saved[s.plots[e.plot].village] += e.litresSaved;
  return { followed, saved };
}

export type Ripple = { label: string; items: string[] };

const sameEntry = (x: PlotEvent, e: PlotEvent) => x.plot === e.plot && x.day === e.day && x.hour === e.hour && x.type === e.type;

/** Entries a farmer logged on the phone that are in season `b` and not in `a`. */
export function loggedSince(a: Season, b: Season) {
  const before = a.events.filter((e) => e.logged);
  return b.events.filter((e) => e.logged && !before.some((x) => sameEntry(x, e)));
}

/** What one logged entry changed: the booked work it replaced, the water it kept, the harvest it moved. */
function loggedRipple(a: Season, b: Season, e: PlotEvent): string[] {
  const id = b.plots[e.plot].id;
  const out: string[] = [];
  const booked = (s: Season) => s.eventsByPlot[e.plot].filter((x) => x.type === "spray" && !x.logged && x.day >= e.day && x.day <= e.day + 3).length;
  if (e.type === "spray") {
    if (e.washedOff) {
      const next = b.eventsByPlot[e.plot].find((x) => x.type === "spray" && !x.logged && x.day > e.day);
      out.push(`${id}: ${b.weather[e.day].rainMm.toFixed(0)} mm of rain on ${fmtDay(e.day)} washes the spray off${next ? `; repeat booked for ${fmtDay(next.day)} at 06:00` : ""}`);
    } else {
      const done = booked(a) - booked(b);
      const sick = a.infected[e.day][e.plot] === 2;
      const treats = sick && b.infected[e.day][e.plot] === 3;
      const effect = treats ? "; it treats the blight already on the plot" : sick ? "; blight is already on the plot and a preventive spray will not treat it" : "; canopy covered for 10 days";
      out.push(`${id} logged ${e.product} on ${fmtDay(e.day)}${effect}${done > 0 ? "; the spray booked for the next three days is already done" : ""}`);
      if (treats) return out;
    }
  } else if (e.type === "irrigate-skip") {
    out.push(`${id} skipped a watering on ${fmtDay(e.day)}: ${(e.litresSaved / 1000).toFixed(1)} kL stays in the village aquifer`);
  } else if (e.type === "irrigate") {
    out.push(`${id} watered ${(e.litres / 1000).toFixed(1)} kL by drip on ${fmtDay(e.day)}; the next watering is planned from there`);
  } else if (e.type === "pick") {
    const was = a.eventsByPlot[e.plot].find((x) => x.type === "pick" && x.picking === e.picking);
    out.push(`${id} picked ${e.crates} crates, grade ${e.grade}, on ${fmtDay(e.day)}${was && was.type === "pick" && (was.day !== e.day || was.crates !== e.crates) ? ` (planned: ${was.crates} crates on ${fmtDay(was.day)})` : ""}`);
    const wk = weekOf(e.day);
    const v = b.plots[e.plot].village;
    const da = a.harvestByWeek[wk]?.[v] ?? 0, db = b.harvestByWeek[wk]?.[v] ?? 0;
    if (da !== db) out.push(`Harvest Wave: ${geo.villages[v].name} picks ${db} crates that week (was ${da})`);
  }
  const end = Math.min(SEASON_DAYS - 1, e.day + 21);
  if (a.infected[end][e.plot] > 0 && b.infected[end][e.plot] === 0) out.push(`${id}: blight kept out of the plot for the next three weeks`);
  else if (a.infected[end][e.plot] === 2 && b.infected[end][e.plot] === 3) out.push(`${id}: blight on the plot treated`);
  return out;
}

/** What changed between two versions of the season from `day` onward, in plain words. */
export function diffSeasons(a: Season, b: Season, day: number, label: string): Ripple {
  const items: string[] = [];
  const hero = b.heroPlot;
  const heroId = b.plots[hero].id;
  const fresh = loggedSince(a, b);
  const sprays = (s: Season) => s.eventsByPlot[hero].filter((e) => e.type === "spray" && e.day >= day && !e.logged).map((e) => e.day);
  const sa = sprays(a), sb = sprays(b);
  // A spray she logged explains its own changes below; this line is for sprays the system books.
  if (sa.join() !== sb.join() && sb.length && !fresh.some((e) => e.plot === hero && e.type === "spray")) items.push(`${heroId} curative spray set for ${sb[0] - day === 1 ? "tomorrow" : `${fmtDay(sb[0])}`} at 06:00, first dry, calm morning`);
  for (const e of fresh) items.push(...loggedRipple(a, b, e));
  const riskA = riskCounts(a, day), riskB = riskCounts(b, day);
  const warnA = riskA[2] + riskA[3], warnB = riskB[2] + riskB[3];
  if (warnA !== warnB || riskA[1] !== riskB[1]) items.push(`Pest Radar: ${warnB} ${warnB === 1 ? "hex" : "hexes"} on warning (was ${warnA}), ${riskB[1]} on watch (was ${riskA[1]})`);
  const warned = (s: Season) => s.eventsByDay[day].filter((e) => e.type === "advisory" && e.text.startsWith("Blight confirmed")).length;
  if (warned(b) > warned(a)) items.push(`${warned(b) - warned(a)} neighbouring plots warned to spray preventively`);
  const skips = (s: Season) => s.events.filter((e) => e.type === "irrigate-skip" && e.day >= day && e.day <= day + 2).length;
  if (skips(b) > skips(a)) items.push(`Irrigation skipped on ${skips(b) - skips(a)} more plots; ${((b.waterSavedByDay[Math.min(SEASON_DAYS - 1, day + 2)] - a.waterSavedByDay[Math.min(SEASON_DAYS - 1, day + 2)]) / 1e6).toFixed(2)} ML stays in the ground`);
  const picksMoved = b.events.filter((e) => e.type === "advisory" && e.day >= day && e.text.startsWith("Rain of 8 mm")).length - a.events.filter((e) => e.type === "advisory" && e.day >= day && e.text.startsWith("Rain of 8 mm")).length;
  if (picksMoved > 0) items.push(`${picksMoved} pickings brought forward ahead of rain`);
  // The engine's expected grade; a picking she logged states its own grade.
  const gradeOf = (s: Season) => s.eventsByPlot[hero].find((e): e is Extract<PlotEvent, { type: "pick" }> => e.type === "pick" && !e.logged)?.grade;
  if (gradeOf(a) !== gradeOf(b)) items.push(`${heroId} expected grade ${gradeOf(a)} → ${gradeOf(b)} at harvest`);
  const runsA = a.runs.filter((r) => r.day >= day).length, runsB = b.runs.filter((r) => r.day >= day).length;
  if (runsA !== runsB) items.push(`Pooled runs re-planned: ${runsB} ahead (was ${runsA})`);
  const advised = (s: Season) => s.eventsByDay[day].filter((e) => e.type === "advisory" && e.text.startsWith("Officer advisory"));
  if (advised(b).length > advised(a).length) {
    const sms = advised(b).filter((e) => e.type === "advisory" && e.text.includes("(SMS)")).length - advised(a).filter((e) => e.type === "advisory" && e.text.includes("(SMS)")).length;
    const total = advised(b).length - advised(a).length;
    const sprays = (s: Season) => s.events.filter((e) => e.type === "spray" && e.reason.startsWith("Officer advisory") && e.day >= day && e.day <= day + 3).length;
    const booked = sprays(b) - sprays(a);
    items.push(`${total} ${total === 1 ? "plot" : "plots"} told to spray before the weather turns (${total - sms} on the app, ${sms} by SMS); ${booked} preventive ${booked === 1 ? "spray" : "sprays"} booked`);
    const end = Math.min(SEASON_DAYS - 1, day + 21);
    const fresh = (s: Season) => s.plots.reduce((c, _, p) => c + (s.infected[day][p] === 0 && s.infected[end][p] > 0 ? 1 : 0), 0);
    if (fresh(a) !== fresh(b)) items.push(`New infections expected in the next three weeks: ${fresh(a)} → ${fresh(b)}`);
  }
  const slipSales = (s: Season) => s.eventsByPlot[hero].filter((e): e is Extract<PlotEvent, { type: "sale" }> => e.type === "sale" && !!e.slip);
  for (const e of slipSales(b).filter((e) => !slipSales(a).some((x) => x.day === e.day && x.gross === e.gross && x.net === e.net))) {
    items.push(`${heroId} sale slip of ${fmtDay(e.day)} checked on the phone: net ₹${Math.round(e.net).toLocaleString("en-IN")}${e.slip!.aboveCard > 0 ? `, ₹${e.slip!.aboveCard.toLocaleString("en-IN")} charged above the agreed rate card` : ", every deduction as agreed"}`);
  }
  return { label, items };
}

export const weekOfDay = weekOf;

/** The week the wave views show: a pinned week, else today's week once pickings start, else the peak. */
export function focusWeek(s: Season, day: number, pinned: number | null) {
  if (pinned !== null) return pinned;
  const totals = weekTotals(s);
  const now = weekOf(day);
  if ((totals[now] ?? 0) > 0) return now;
  return totals.reduce((best, v, i) => (v > totals[best] ? i : best), 0);
}
