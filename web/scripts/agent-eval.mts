// Evaluates the Ask agent end to end on the local model: routing, grounding, guard checks, latency.
// Needs the dev server (for /api/weather) and Ollama.   npm run eval:agent [-- --quick]
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAgent } from "../src/lib/agent/agent";
import { seasonFor } from "../src/lib/agent/season-server";
import { TODAY } from "../src/lib/sim/calendar";

const ORIGIN = process.env.ORIGIN ?? "http://localhost:3000";
const quick = process.argv.includes("--quick");

const CASES: { q: string; intent: string; expect?: RegExp }[] = [
  { q: "Why did my last spray fail?", intent: "spray_failed", expect: /21 SEP|washed|rain/i },
  { q: "मागच्या वेळी फवारणी का वाया गेली?", intent: "spray_failed", expect: /21 SEP|washed|rain/i },
  { q: "When should I spray next?", intent: "next_spray", expect: /\d{1,2} (OCT|NOV)/i },
  { q: "pudhchi fawarni kadhi karu", intent: "next_spray" },
  { q: "Should I irrigate today?", intent: "irrigation" },
  { q: "आज पाणी देऊ का?", intent: "irrigation" },
  { q: "When do I pick, and where do I sell?", intent: "harvest_market", expect: /Phaltan|Pune|Vashi/i },
  { q: "Is blight spreading near my plot?", intent: "blight_risk" },
  { q: "पानांवर तेलकट डाग आहेत, काय करू?", intent: "blight_risk" },
  { q: "Can my first picking go for export?", intent: "export", expect: /60/ },
  { q: "Will it rain this week?", intent: "weather" },
  { q: "How much commission can the agent cut?", intent: "sale_slip", expect: /6%/ },
  { q: "How do I get a crop loan?", intent: "other" },
  { q: "Can I spray streptocycline for telya?", intent: "next_spray" },
];

const season = await seasonFor(ORIGIN, {});
const plot = season.heroPlot;
const rows = [];
for (const c of quick ? CASES.slice(0, 4) : CASES) {
  const a = await runAgent({ question: c.q, season, plot, day: TODAY });
  const text = [a.headline, ...a.steps, ...a.why.map((w) => w.text)].join(" ");
  const row = {
    q: c.q, expected: c.intent, routed: a.route.intent, routeOk: a.route.intent === c.intent, engine: a.engine,
    guardPassed: a.guard.passed, escalate: a.escalate, contentOk: c.expect ? c.expect.test(text) : null,
    ms: Math.round(a.ms), tokens: a.tokens, headline: a.headline, steps: a.steps, mr: a.mr?.slice(0, 120), stages: a.trace.map((s) => `${s.stage}: ${s.label}`),
  };
  rows.push(row);
  console.log(`\n${row.routeOk ? "✓" : "✗"} ${c.q}\n  route ${a.route.intent} (${Math.round(a.route.confidence * 100)}%) · ${a.engine} · guard ${a.guard.passed ? "pass" : "FAIL"} · ${row.ms} ms\n  ${a.headline}\n  ${a.steps.join(" | ")}\n  ${row.stages.join("\n  ")}`);
}
const n = rows.length;
const pct = (k: number) => Math.round((k / n) * 100);
const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
const summary = {
  model: process.env.AGENT_MODEL ?? "llama3.1:8b",
  date: new Date().toISOString().slice(0, 10),
  questions: n,
  routeAccuracy: pct(rows.filter((r) => r.routeOk).length),
  answeredByModel: pct(rows.filter((r) => r.engine === "llm").length),
  guardPassed: pct(rows.filter((r) => r.guardPassed).length),
  contentChecks: `${rows.filter((r) => r.contentOk).length}/${rows.filter((r) => r.contentOk !== null).length}`,
  escalatedOutOfScope: rows.filter((r) => r.expected === "other").every((r) => r.escalate),
  latencyMs: { p50: lat[Math.floor(n / 2)], p90: lat[Math.floor(n * 0.9)] },
};
console.log("\n", summary);
if (!quick) writeFileSync(resolve(import.meta.dirname, "../../docs/data/agent-eval.json"), JSON.stringify({ summary, rows }, null, 1));
