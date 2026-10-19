// Captures the pitch page: the hero, then the season story at points through the scroll.
// Usage: node scripts/capture-pitch.mjs <outDir> [width] [height] [--mobile]
import puppeteer from "puppeteer-core";

const [out = ".", w = "1440", h = "900", ...flags] = process.argv.slice(2);
const mobile = flags.includes("--mobile");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = mobile ? "m" : "d";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
  await page.evaluate(() => document.fonts.ready);
  await sleep(1500);
  await page.screenshot({ path: `${out}/pitch-${tag}-hero.png` });
  const { top, height } = await page.evaluate(() => {
    const s = document.querySelector("section[aria-label^='One season']");
    const r = s.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: s.scrollHeight - window.innerHeight };
  });
  for (const f of [0.08, 0.3, 0.5, 0.6, 0.7, 0.82, 0.97]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(top + f * height));
    await sleep(1100);
    await page.screenshot({ path: `${out}/pitch-${tag}-${String(Math.round(f * 100)).padStart(2, "0")}.png` });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(800);
  await page.screenshot({ path: `${out}/pitch-${tag}-end.png`, fullPage: false });
  console.log("captured pitch", tag, await page.evaluate(() => document.documentElement.scrollWidth));
} finally {
  await browser.close();
}
