// Reads the specimen slips with Tesseract in Node and checks the parser and the rate-card checks.
// Usage: npx tsx --tsconfig tsconfig.json scripts/slip-test.ts
import { createWorker, OEM } from "tesseract.js";
import { checkSlip, owed, parseSlip, rateCardFor, type OcrLine } from "../src/lib/patti";
import { generateSeason } from "../src/lib/sim/season";

const EXPECT = [
  { name: "slip-fair", langs: ["eng"], gross: 74340, net: 67990, charges: 4, owed: 0 },
  { name: "slip-extra", langs: ["eng"], gross: 74340, net: 66127, charges: 5, owed: 1863 },
  // Marathi labels and Devanagari digits; the net is printed ₹100 short.
  { name: "slip-marathi", langs: ["mar", "eng"], gross: 74340, net: 67890, charges: 4, owed: 100 },
];

async function main() {
  const season = generateSeason();
  let failed = 0;
  for (const want of EXPECT) {
    const worker = await createWorker(want.langs, OEM.LSTM_ONLY, { langPath: "public/tesseract/lang", gzip: true, cacheMethod: "none" });
    try {
      const t0 = Date.now();
      const { data } = await worker.recognize(`public/samples/${want.name}.jpg`, {}, { blocks: true });
      const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({ text: l.text, confidence: l.confidence, bbox: l.bbox, words: l.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })) }));
      const slip = parseSlip(lines);
      const checks = checkSlip(slip, rateCardFor(season, season.heroPlot, slip.market));
      const got = { gross: slip.gross, net: slip.net, charges: slip.charges.length, owed: owed(checks) };
      const ok = got.gross === want.gross && got.net === want.net && got.charges === want.charges && got.owed === want.owed && slip.day === 164 && slip.crates === 63;
      if (!ok) failed++;
      const notes = [slip.repairs.length ? `${slip.repairs.length} corrected` : "", slip.unread.length ? `${slip.unread.join(",")} unread` : ""].filter(Boolean).join(", ");
      console.log(`${ok ? "PASS" : "FAIL"}  ${want.name} (${want.langs.join("+")}) in ${Date.now() - t0} ms  ·  ${JSON.stringify(got)}${notes ? `  ·  ${notes}` : ""}`);
    } finally {
      await worker.terminate();
    }
  }
  if (failed) process.exitCode = 1;
}

void main();
