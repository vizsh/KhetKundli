// Review captures with the local Chrome: exact viewport, DPR 1, after live data settles.
// Usage: node scripts/capture.mjs <url> <out.png> <width> <height> [--full] [--mobile] [--scroll=<css selector>]
import puppeteer from "puppeteer-core";

const [url, out, w = "1440", h = "900", ...flags] = process.argv.slice(2);
const full = flags.includes("--full");
const mobile = flags.includes("--mobile");
const scrollTo = flags.find((f) => f.startsWith("--scroll="))?.slice(9);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const weather = page.waitForResponse((r) => r.url().includes("/api/weather"), { timeout: 20000 }).catch(() => null);
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await weather;
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1800));
  if (scrollTo) {
    await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), scrollTo);
    await new Promise((r) => setTimeout(r, 600));
  }
  await page.screenshot({ path: out, fullPage: full });
  const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  console.log(out, JSON.stringify(metrics));
} finally {
  await browser.close();
}
