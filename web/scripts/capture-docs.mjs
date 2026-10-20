// Regenerates the screenshots in docs/images from the running dev server (JPEG, DPR 1).
// Usage: node scripts/capture-docs.mjs [baseUrl]
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/images");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (p, sel, text) => p.evaluate((s, t) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent?.includes(t)); el?.click(); return Boolean(el); }, sel, text);
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 84 });
const reset = () => fetch(`${BASE}/api/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "reset", from: "docs" }) }).catch(() => {});
const rect = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);

mkdirSync(OUT, { recursive: true });
await reset();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
try {
  // Desk, today: a storm forecast and the plume it would carry.
  const desk = await browser.newPage();
  await desk.setViewport({ width: 1440, height: 900 });
  await desk.goto(`${BASE}/desk`, { waitUntil: "networkidle2" });
  await desk.evaluate(() => document.fonts.ready);
  await sleep(2500);
  await shot(desk, "desk-today");
  await click(desk, "button", "Rain forecast in 18 h");
  await sleep(1200);
  let strip = await rect(desk, "svg[aria-label='Forecast hour']");
  await desk.mouse.click(strip.x + strip.w * 0.3, strip.y + strip.h / 2);
  await sleep(2200);
  await shot(desk, "desk-storm");

  // Desk, 19 September: the spread forecast replayed on the recorded monsoon, then the advisory.
  await reset();
  await desk.goto(`${BASE}/desk`, { waitUntil: "networkidle2" });
  await sleep(2500);
  const track = await rect(desk, "svg[aria-label='Season day']");
  await desk.mouse.click(track.x + track.w * ((6 + (110.5 / 245) * 408) / 420), track.y + track.h / 2);
  await sleep(1200);
  strip = await rect(desk, "svg[aria-label='Forecast hour']");
  await desk.mouse.click(strip.x + strip.w * 0.62, strip.y + strip.h / 2);
  await sleep(1500);
  await click(desk, "button", "Warn ");
  await sleep(2200);
  await shot(desk, "desk-monsoon");
  await desk.evaluate(() => document.querySelector("[aria-label='Dismiss ripple']")?.click());
  for (const layer of ["Harvest Wave", "Pooled Runs"]) {
    await click(desk, "button", layer);
    await sleep(1200);
  }
  await desk.mouse.click(track.x + track.w * ((6 + (175.5 / 245) * 408) / 420), track.y + track.h / 2);
  await sleep(2000);
  await shot(desk, "desk-runs");
  await click(desk, "button", "Harvest Wave");
  await sleep(1500);
  await shot(desk, "desk-wave");

  // Phone.
  await reset();
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await phone.goto(`${BASE}/farmer`, { waitUntil: "networkidle2" });
  await phone.evaluate(() => document.fonts.ready);
  await sleep(1800);
  await shot(phone, "phone-home");
  await click(phone, "nav button", "Ask");
  await sleep(500);
  await phone.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent?.includes("Why did my last spray fail"))?.click());
  await sleep(1200);
  await shot(phone, "phone-ask");
  await phone.evaluate(() => document.querySelector("[role=dialog] button[aria-label='Close']")?.click());
  await sleep(700);
  await click(phone, "button", "Check a sale slip");
  await sleep(600);
  await click(phone, "[role=dialog] button", "A slip with extra charges");
  await phone.waitForFunction(() => /read on this phone in [0-9.]+ s/.test(document.body.textContent ?? ""), { timeout: 60000, polling: 200 });
  await sleep(1500);
  await shot(phone, "phone-slip");
  await phone.evaluate(() => [...document.querySelectorAll("[role=dialog]")].at(-1)?.scrollTo({ top: 560 }));
  await sleep(500);
  await shot(phone, "phone-slip-ledger");

  // Pitch.
  const pitch = await browser.newPage();
  await pitch.setViewport({ width: 1440, height: 900 });
  await pitch.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await pitch.evaluate(() => document.fonts.ready);
  await sleep(1800);
  await shot(pitch, "pitch-hero");
  const story = await pitch.evaluate(() => { const s = document.querySelector("section[aria-label^='One season']"); const r = s.getBoundingClientRect(); return { top: r.top + window.scrollY, height: s.scrollHeight - window.innerHeight }; });
  await pitch.evaluate((y) => window.scrollTo(0, y), Math.round(story.top + 0.5 * story.height));
  await sleep(1500);
  await shot(pitch, "pitch-ripple");
  console.log("docs images written to", OUT);
} finally {
  await browser.close();
  await reset();
}
