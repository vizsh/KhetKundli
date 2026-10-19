// Review captures of the phone's sheets in action: a live tomato scan and a voice answer.
// Usage: node scripts/capture-sheets.mjs <outDir> [baseUrl]
import puppeteer from "puppeteer-core";

const [out = ".", BASE = "http://localhost:3000"] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (page, sel, text) => page.evaluate((s, t) => [...document.querySelectorAll(s)].find((e) => e.textContent?.includes(t))?.click(), sel, text);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/farmer`, { waitUntil: "networkidle0" });
  await sleep(1200);

  await click(page, "nav button", "Scan a leaf");
  await sleep(500);
  await click(page, "[role=dialog] button", "Tomato");
  await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button[title]")].find((b) => b.title.includes("Septoria leaf spot."))?.click());
  await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => d.textContent?.includes("Red shows where")), { timeout: 30000, polling: 200 });
  await sleep(800);
  await page.evaluate(() => document.querySelector("[role=dialog]")?.scrollTo({ top: 330 }));
  await sleep(400);
  await page.screenshot({ path: `${out}/scan.png` });
  await page.evaluate(() => document.querySelector("[aria-label='Close scan']")?.click());
  await sleep(700);

  await click(page, "nav button", "Ask");
  await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent?.includes("Why did my last spray fail"))?.click());
  await sleep(900);
  await page.evaluate(() => document.querySelector("[role=dialog]")?.scrollTo({ top: 260 }));
  await sleep(300);
  await page.screenshot({ path: `${out}/ask.png` });
  console.log("captured scan.png and ask.png");
} finally {
  await browser.close();
}
