// Checks that the TypeScript router reproduces scikit-learn's probabilities on fixtures that
// ml/router/train.py writes after training.   npm run test:router
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { charProbs } from "../src/lib/agent/router";

const fixtures = JSON.parse(readFileSync(resolve(import.meta.dirname, "router-fixtures.json"), "utf8")) as { text: string; proba: number[] }[];
let worst = 0;
for (const f of fixtures) {
  const p = charProbs(f.text);
  worst = Math.max(worst, ...p.map((v, i) => Math.abs(v - f.proba[i])));
}
const ok = worst < 1e-3;
console.log(`${ok ? "PASS" : "FAIL"}  router parity on ${fixtures.length} questions · max probability difference ${worst.toExponential(2)}`);
process.exit(ok ? 0 : 1);
