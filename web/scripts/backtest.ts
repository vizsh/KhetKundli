// Backtest of the 72-hour spread forecast over the recorded season: for each day, forecast every cell
// with no blight reported yet, then check whether blight is reported there 8 to 24 days later: an
// infection carried in the next 72 hours shows symptoms after a 10 to 14 day latent period, and is
// then scanned and reported. (A window of days 1 to 14 mostly scores infections that were already latent.)
// Scored as ROC AUC and precision of the "warn" cells, against a distance-only baseline.
// The reports are the simulation's, so this tests the method and the harness; the pilot will score it
// against real reports. Writes ../docs/data/backtest.json.
// Usage (dev server running for recorded weather): npx tsx --tsconfig tsconfig.json scripts/backtest.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geo, kmBetween } from "../src/lib/geo";
import { fmtDay } from "../src/lib/sim/calendar";
import { generateSeason } from "../src/lib/sim/season";
import type { LiveDaily } from "../src/lib/sim/weather";
import { framesFor, spreadForecast } from "../src/lib/spread";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LAG_FROM = 8, LAG_TO = 24;

/** Area under the ROC curve by ranks (Mann–Whitney), ties counted half. */
function auc(scores: number[], labels: boolean[]) {
  const idx = scores.map((s, i) => [s, labels[i]] as const).sort((a, b) => a[0] - b[0]);
  let pos = 0, neg = 0, rankSum = 0;
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avg = (i + j + 1) / 2;
    for (let k = i; k < j; k++) if (idx[k][1]) { rankSum += avg; pos++; } else neg++;
    i = j;
  }
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN;
}

async function main() {
  const base = process.argv[2] ?? "http://localhost:3000";
  const live: LiveDaily[] = await fetch(`${base}/api/weather`).then((r) => r.json()).then((j) => j.days ?? []).catch(() => []);
  const season = generateSeason({ live });
  const recordedThrough = season.recordedThrough;
  const first = 40, last = Math.min(recordedThrough >= 0 ? recordedThrough - LAG_TO : 130, 160);
  const H = geo.hexes.length;
  const scansByDay = season.eventsByDay.map((list) => list.filter((e) => e.type === "scan" && e.finding === "bacterial-blight").map((e) => season.plots[e.plot].hex));

  // The oracle sees every symptomatic orchard, reported or not: the ceiling if every plot were scanned.
  const model: number[] = [], distance: number[] = [], oracle: number[] = [], labels: boolean[] = [];
  const byMonth = new Map<string, { m: number[]; d: number[]; y: boolean[] }>();
  let warned = 0, warnedHit = 0, hits = 0, hitsWarned = 0;
  const daily: { day: number; date: string; auc: number; base: number; positives: number }[] = [];
  for (let day = first; day <= last; day++) {
    const risk = season.hexRisk[day];
    const sources = geo.hexes.flatMap((h, i) => (risk[i] ? [i] : []));
    if (!sources.length) continue;
    const { frames } = framesFor(season, day + 0.23, null, {});
    const f = spreadForecast(season, day, frames, null);
    const truth = new Uint8Array(H);
    season.plots.forEach((p, i) => { if (season.infected[day][i] === 2) truth[p.hex] = 2; });
    const fo = spreadForecast({ ...season, hexRisk: season.hexRisk.map((r, k) => (k === day ? truth : r)) }, day, frames, null);
    const future = new Set<number>();
    for (let k = day + LAG_FROM; k <= day + LAG_TO; k++) for (const h of scansByDay[k] ?? []) future.add(h);
    const dm: number[] = [], dd: number[] = [], dor: number[] = [], dy: boolean[] = [];
    for (let j = 0; j < H; j++) {
      if (risk[j]) continue;
      const y = future.has(j);
      const near = Math.min(...sources.map((s) => kmBetween(geo.hexes[s].center, geo.hexes[j].center)));
      dm.push(f.exposure[j]); dd.push(-near); dor.push(fo.exposure[j] + (truth[j] ? 100 : 0)); dy.push(y);
      if (f.tier[j] >= 2) { warned++; if (y) warnedHit++; }
      if (y) { hits++; if (f.tier[j] >= 2) hitsWarned++; }
    }
    model.push(...dm); distance.push(...dd); oracle.push(...dor); labels.push(...dy);
    const month = fmtDay(day).slice(3);
    const bucket = byMonth.get(month) ?? { m: [], d: [], y: [] };
    bucket.m.push(...dm); bucket.d.push(...dd); bucket.y.push(...dy);
    byMonth.set(month, bucket);
    daily.push({ day, date: fmtDay(day), auc: auc(dm, dy), base: auc(dd, dy), positives: dy.filter(Boolean).length });
  }

  const result = {
    note: "Scored against the simulation's own reported scans; the pilot will score the same harness against real reports.",
    window: { first: fmtDay(first), last: fmtDay(last), days: daily.length, reportedFromDay: LAG_FROM, reportedToDay: LAG_TO, weather: recordedThrough >= 0 ? "recorded (Open-Meteo archive)" : "simulated" },
    pairs: labels.length,
    positives: labels.filter(Boolean).length,
    auc: { forecast: auc(model, labels), distanceOnly: auc(distance, labels), oracleAllSymptomatic: auc(oracle, labels) },
    warnCells: { flagged: warned, precision: warned ? warnedHit / warned : 0, recall: hits ? hitsWarned / hits : 0, baseRate: labels.filter(Boolean).length / labels.length },
    byMonth: [...byMonth].map(([month, b]) => ({ month, forecast: auc(b.m, b.y), distanceOnly: auc(b.d, b.y), positives: b.y.filter(Boolean).length })),
    daily,
  };
  mkdirSync(resolve(root, "docs/data"), { recursive: true });
  writeFileSync(resolve(root, "docs/data/backtest.json"), JSON.stringify(result, null, 1));
  const p = (x: number) => x.toFixed(3);
  console.log(`window ${result.window.first} to ${result.window.last} (${result.window.days} days, ${result.window.weather}); ${result.pairs} cell-days, ${result.positives} with new blight reported ${LAG_FROM}–${LAG_TO} days later`);
  console.log(`ROC AUC: forecast ${p(result.auc.forecast)} vs distance-only ${p(result.auc.distanceOnly)}; oracle with every symptomatic orchard ${p(result.auc.oracleAllSymptomatic)}`);
  console.log(`warn cells: ${warned} flagged, precision ${p(result.warnCells.precision)} (base rate ${p(result.warnCells.baseRate)}), recall ${p(result.warnCells.recall)}`);
  for (const m of result.byMonth) console.log(`  ${m.month}: forecast ${p(m.forecast)} vs distance ${p(m.distanceOnly)} (${m.positives} positives)`);
}

void main();
