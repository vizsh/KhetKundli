// Reads both specimen slips with Tesseract in Node and checks the parser and the rate-card checks.
// Usage: npx tsx --tsconfig tsconfig.json scripts/slip-test.ts
import { createWorker, OEM } from "tesseract.js";
import { checkSlip, owed, parseSlip, rateCardFor, type OcrLine } from "../src/lib/patti";
import { generateSeason } from "../src/lib/sim/season";

const EXPECT = {
  "slip-fair": { gross: 74340, net: 67990, charges: 4, owed: 0 },
  "slip-extra": { gross: 74340, net: 66127, charges: 5, owed: 1863 },
};

async function main() {
  const season = generateSeason();
  const worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath: "public/tesseract/lang", gzip: true, cacheMethod: "none" });
  let failed = 0;
  try {
    for (const [name, want] of Object.entries(EXPECT)) {
      const t0 = Date.now();
      const { data } = await worker.recognize(`public/samples/${name}.jpg`, {}, { blocks: true });
      const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({ text: l.text, confidence: l.confidence, bbox: l.bbox, words: l.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })) }));
      const slip = parseSlip(lines);
      const checks = checkSlip(slip, rateCardFor(season, season.heroPlot, slip.market));
      const got = { gross: slip.gross, net: slip.net, charges: slip.charges.length, owed: owed(checks) };
      const ok = Object.entries(want).every(([k, v]) => got[k as keyof typeof got] === v) && slip.day === 164 && slip.crates === 63;
      if (!ok) failed++;
      console.log(`${ok ? "PASS" : "FAIL"}  ${name} in ${Date.now() - t0} ms  ·  ${JSON.stringify(got)}`);
    }
  } finally {
    await worker.terminate();
  }
  if (failed) process.exitCode = 1;
}

void main();
