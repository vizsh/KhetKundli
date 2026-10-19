// End-to-end smoke test of the demo flows with the local Chrome (run with the dev server up).
// Usage: node scripts/smoke.mjs [baseUrl]
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] ?? "http://localhost:3000";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, selector, text) =>
  page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent?.includes(t));
    if (!el) return false;
    el.click();
    return true;
  }, selector, text);
const textOf = (page, selector) => page.evaluate((sel) => [...document.querySelectorAll(sel)].at(-1)?.textContent ?? "", selector);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on("pageerror", (e) => check("no page errors", false, String(e)));
  await page.goto(`${BASE}/farmer`, { waitUntil: "networkidle0" });

  // Scan Lens on two sample leaves, crop-conditioned.
  for (const [crop, sample] of [["Capsicum", "bacterial spot"], ["Tomato", "Septoria leaf spot."]]) {
    await clickText(page, "nav button", "Scan a leaf");
    await sleep(500);
    await clickText(page, "[role=dialog] button", crop);
    await sleep(300);
    await page.evaluate((s) => [...document.querySelectorAll("[role=dialog] button[title]")].find((b) => b.title.includes(s))?.click(), sample);
    await page.waitForFunction(() => /on-device, \d+ ms/.test([...document.querySelectorAll("[role=dialog]")].at(-1)?.textContent ?? ""), { timeout: 30000, polling: 200 });
    await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].at(-1)?.textContent?.includes("Red shows where"), { timeout: 30000, polling: 200 });
    const dialog = await textOf(page, "[role=dialog]");
    const label = dialog.match(/(Tomato[^0-9]*?|Bell Pepper[^0-9]*?|Healthy[^0-9]*?)on-device, (\d+) ms/);
    check(`scan ${crop}: on-device result within crop`, Boolean(label), label ? `${label[1].trim()} in ${label[2]} ms` : dialog.slice(0, 200));
    await page.evaluate(() => document.querySelector("[aria-label='Close scan']")?.click());
    await sleep(700);
  }

  // Ask: typed question answered from the plot record.
  await clickText(page, "nav button", "Ask");
  await sleep(500);
  await page.type("[role=dialog] input", "Why did my last spray fail?");
  await page.evaluate(() => document.querySelector("[role=dialog] form")?.requestSubmit());
  await sleep(500);
  const ask = await textOf(page, "[role=dialog]");
  check("ask: answer cites the washed-off spray", /washed it off/.test(ask) && /27 SEP|26 SEP/.test(ask), ask.match(/On \d\d [A-Z]{3}[^.]*\./)?.[0] ?? ask.slice(0, 160));
  check("ask: Marathi answer present", /फवारणी/.test(ask));

  // Phone and desk in two tabs: a pomegranate scan saved on the phone ripples on the desk.
  const desk = await browser.newPage();
  await desk.setViewport({ width: 1440, height: 900 });
  await desk.goto(`${BASE}/desk`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector("[aria-label='Close']")?.click());
  await sleep(500);
  await clickText(page, "nav button", "Scan a leaf");
  await sleep(500);
  await clickText(page, "[role=dialog] button", "Pomegranate");
  // No pomegranate samples exist; feed a photo through the file input instead.
  const input = await page.$("[role=dialog] input[type=file]");
  await input.uploadFile(new URL("../public/samples/s1.jpg", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
  const saved = await page.waitForFunction(() => [...document.querySelectorAll("[role=dialog]")].some((d) => d.textContent?.includes("Save to my record")), { timeout: 10000, polling: 200 }).then(() => true, () => false);
  if (!saved) check("pomegranate scan reaches save", false, (await textOf(page, "body")).slice(0, 300));
  await clickText(page, "[role=dialog] button", "Save to my record");
  await desk.waitForFunction(() => document.body.textContent?.includes("Leaf scan synced from Sunita"), { timeout: 10000, polling: 200 }).then(
    () => check("sync: desk shows the ripple from the phone", true),
    () => check("sync: desk shows the ripple from the phone", false),
  );
  const ripple = await textOf(desk, "[role=status]");
  check("sync: ripple lists consequences", /spray|Pest Radar|grade/.test(ripple), ripple.slice(0, 220));
} catch (err) {
  check("smoke run completed", false, String(err).slice(0, 200));
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  ·  ${r.detail}` : ""}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
