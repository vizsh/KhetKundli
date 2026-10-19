import { generateSeason } from "../src/lib/sim/season";
const t0 = performance.now();
const s = generateSeason();
const t1 = performance.now();
console.log("ms", Math.round(t1 - t0), "plots", s.plots.length, "events", s.events.length, "runs", s.runs.length);
const counts: Record<string, number> = {};
s.events.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
console.log(counts);
for (const d of [60, 90, 120, 140, 170, 200, 244]) {
  const inf = s.infected[d]; let a=0,b=0,c=0; inf.forEach(x=>{if(x===1)a++;if(x===2)b++;if(x===3)c++;});
  const r = s.hexRisk[d]; const lv=[0,0,0,0]; r.forEach(x=>lv[x]++);
  console.log(d, "latent", a, "sympt", b, "treated", c, "hexRisk", lv.join("/"), "water", s.waterSavedByDay[d], "share", s.forecastIrrigationShare[d].toFixed(2), "price", s.prices.phaltan[d], s.prices.pune[d], s.prices.vashi[d]);
}
const h = s.heroPlot; console.log("hero", s.plots[h].id, s.plots[h].farmer.name, s.eventsByPlot[h].map(e=>e.day+":"+e.type).join(" "));
const wk = s.harvestByWeek.map(w=>w.reduce((a,b)=>a+b,0)); console.log("wave", wk.join(","));
const t2 = performance.now();
const s2 = generateSeason({ overrides: { scans: [{ plot: h, day: 140, confidence: 0.87, offline: true }], rain: { day: 141, mm: 18 } } });
console.log("ms2", Math.round(performance.now()-t2), "hero after", s2.eventsByPlot[h].filter(e=>e.day>=140).map(e=>e.day+":"+e.type+(e.type==='spray'?'('+e.washedOff+')':'')+(e.type==='pick'?e.grade:'')).join(" "));
console.log("risk140 before/after", s.hexRisk[140][s.plots[h].hex], s2.hexRisk[140][s2.plots[h].hex]);
// butterfly check: a hero scan must not change detections far from the hero
const near = new Set(s.plots.map((p, i) => ({ i, km: Math.hypot((p.at[0]-s.plots[h].at[0])*105, (p.at[1]-s.plots[h].at[1])*111) })).filter(x => x.km < 7).map(x => x.i));
const far = (x: typeof s) => x.events.filter(e => e.type === "scan" && !near.has(e.plot)).map(e => `${e.plot}@${e.day}`).join();
const s3 = generateSeason({ overrides: { scans: [{ plot: h, day: 140, confidence: 0.87, offline: true }] } });
console.log("far-from-hero scans unchanged:", far(s) === far(s3));
