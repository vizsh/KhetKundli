// Season statistics for the report, from the engine on Phaltan's recorded weather (dev server running).
// Writes ../docs/data/season-stats.json. Usage: npx tsx --tsconfig tsconfig.json scripts/report/season-stats.ts
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSeason } from "../../src/lib/sim/season";
import { riskCounts } from "../../src/lib/sim/selectors";
import type { LiveDaily } from "../../src/lib/sim/weather";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

async function main() {
  const days: (LiveDaily & { observed?: boolean })[] = await fetch("http://localhost:3000/api/weather").then((r) => r.json()).then((j) => j.days ?? []);
  const s = generateSeason({ live: days });
  const synth = generateSeason();
  const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const recorded = days.filter((d) => d.observed);
  const weather = months.map((m) => {
    const ds = recorded.filter((d) => d.date.startsWith(m));
    return {
      month: m,
      rainMm: Math.round(ds.reduce((a, d) => a + d.rainMm, 0)),
      wetHoursMean: ds.length ? Math.round((ds.reduce((a, d) => a + (d.wetHours ?? 0), 0) / ds.length) * 10) / 10 : 0,
      blightDays: ds.filter((d) => (d.wetHours ?? 0) >= 12).length,
      days: ds.length,
    };
  });
  const last = s.weather.length - 1;
  const runs = s.runs;
  const fill = runs.reduce((a, r) => a + r.crates / r.capacity, 0) / runs.length;
  const crates = runs.reduce((a, r) => a + r.crates, 0);
  const ever = (x: typeof s, d: number) => x.infected[d].reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
  const scans = s.events.filter((e) => e.type === "scan" && e.finding === "bacterial-blight").length;
  const sales = s.events.filter((e) => e.type === "sale");
  const net = sales.reduce((a, e) => a + (e.type === "sale" ? e.net : 0), 0);
  const gross = sales.reduce((a, e) => a + (e.type === "sale" ? e.gross : 0), 0);
  const out = {
    recordedThrough: recorded.at(-1)?.date,
    plots: s.plots.length,
    villages: new Set(s.plots.map((p) => p.village)).size,
    appUsers: s.plots.filter((p) => p.farmer.usesApp).length,
    weather,
    infectedByOct20: { recorded: ever(s, 141), synthetic: ever(synth, 141) },
    blightScans: scans,
    warningEndSep: { recorded: riskCounts(s, 120)[2] + riskCounts(s, 120)[3], synthetic: riskCounts(synth, 120)[2] + riskCounts(synth, 120)[3] },
    waterKeptMl: Math.round((s.waterSavedByDay[last] / 1e6) * 10) / 10,
    forecastIrrigationShare: Math.round(Math.max(...s.forecastIrrigationShare) * 100),
    runs: runs.length,
    meanFillPct: Math.round(fill * 100),
    cratesMoved: crates,
    sales: sales.length,
    deductionsPct: Math.round(((gross - net) / gross) * 1000) / 10,
  };
  writeFileSync(resolve(root, "docs/data/season-stats.json"), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

void main();
