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
  await page.goto(`${BASE}/farmer`, { waitUntil: "networkidle2" });

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
  check("ask: answer cites the washed-off spray", /washed it off/.test(ask) && /On \d\d (SEP|OCT)/.test(ask), ask.match(/On \d\d [A-Z]{3}[^.]*\./)?.[0] ?? ask.slice(0, 160));
  check("ask: Marathi answer present", /फवारणी/.test(ask));

  // Phone and desk in two tabs: a pomegranate scan saved on the phone ripples on the desk.
  const desk = await browser.newPage();
  await desk.setViewport({ width: 1440, height: 900 });
  await desk.goto(`${BASE}/desk`, { waitUntil: "networkidle2" });
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

  // Real data: the season's weather comes from the archive, and the live wind grid has nine points.
  const weather = await desk.evaluate(() => fetch("/api/weather").then((r) => r.json()).then((j) => ({ recordedThrough: j.recordedThrough, days: j.days?.length })));
  check("weather: season recorded from the archive", Boolean(weather.recordedThrough) && weather.days > 100, JSON.stringify(weather));
  const wind = await desk.evaluate(() => fetch("/api/weather/wind").then((r) => r.json()).then((j) => ({ status: j.status, points: j.points?.length, hours: j.times?.length })));
  check("forecast: live wind grid, 9 points", wind.status === "live" && wind.points === 9 && wind.hours >= 72, JSON.stringify(wind));
  // Spread forecast: the demo rain shows up in the 72-hour total.
  await clickText(desk, "button", "Rain forecast in 18 h");
  const rainTotal = () => Number(document.body.textContent?.match(/72 h · (\d+(?:\.\d)?) mm/)?.[1] ?? 0);
  const stormed = await desk.waitForFunction(`(${rainTotal})() >= 18`, { timeout: 10000, polling: 200 }).then(() => true, () => false);
  check("forecast: demo rain enters the 72-hour forecast", stormed, (await desk.evaluate(() => document.body.textContent?.match(/Next 72 hours.{0,140}/)?.[0])) ?? "");

  // Uncertainty: the 51-member ECMWF ensemble for Phaltan.
  const ens = await desk.evaluate(() => fetch("/api/weather/ensemble").then((r) => r.json()).then((j) => ({ status: j.status, members: j.members?.length, hours: j.times?.length })));
  check("forecast: 51-member ensemble", ens.status === "live" && ens.members >= 51 && ens.hours >= 72, JSON.stringify(ens));

  // Storm brush: draw a storm across Adarki's warning cell; the panel answers as a what-if.
  await clickText(desk, "button", "Storm brush");
  await sleep(300);
  const area = await desk.evaluate(() => { const r = document.querySelector("[aria-label^='Draw a storm']")?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; });
  if (area) {
    await desk.mouse.move(area.x + area.w * 0.05, area.y + area.h * 0.72);
    await desk.mouse.down();
    for (const [fx, fy] of [[0.1, 0.66], [0.15, 0.6], [0.2, 0.55], [0.26, 0.5]]) await desk.mouse.move(area.x + area.w * fx, area.y + area.h * fy, { steps: 6 });
    await desk.mouse.up();
  }
  const brushed = await desk.waitForFunction(() => /What if a storm runs/.test(document.body.textContent ?? ""), { timeout: 8000, polling: 200 }).then(() => true, () => false);
  check("forecast: storm brush gives a what-if plume", brushed, (await desk.evaluate(() => document.body.textContent?.match(/What if a storm runs[^.]*\./)?.[0])) ?? "");
  await clickText(desk, "button", "Clear storm");

  // Lot passport: a buyer's page with the export check and a QR code.
  const lotPage = await browser.newPage();
  await lotPage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await lotPage.goto(`${BASE}/lot/TAR-214-P1`, { waitUntil: "networkidle2" });
  const passport = await lotPage.waitForFunction(() => /Export check/.test(document.body.textContent ?? "") && document.querySelector("[aria-label^='QR code'] svg"), { timeout: 10000, polling: 200 }).then(() => true, () => false);
  check("passport: lot page with export check and QR", passport, (await lotPage.evaluate(() => document.body.innerText.match(/(Not for export|Export PHI clear)/)?.[0])) ?? "");
  await lotPage.close();
  check("phone: neighbour pulse around the plot", /Around your plot/.test(await page.evaluate(() => document.body.textContent ?? "")));
} catch (err) {
  check("smoke run completed", false, String(err).slice(0, 200));
} finally {
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  ·  ${r.detail}` : ""}`);
if (!results.every((r) => r.ok)) process.exitCode = 1;

// Network relay: phone and desk in separate browser profiles cannot share a BroadcastChannel,
// so the escalation and the officer's reply can only travel through /api/sync.
{
  const relay = [];
  const browser2 = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const phoneCtx = await browser2.createBrowserContext();
    const deskCtx = await browser2.createBrowserContext();
    const phone = await phoneCtx.newPage();
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const desk = await deskCtx.newPage();
    await desk.setViewport({ width: 1440, height: 900 });
    await desk.goto(`${BASE}/desk`, { waitUntil: "networkidle2" });
    await phone.goto(`${BASE}/farmer`, { waitUntil: "networkidle2" });
    await clickText(phone, "nav button", "Ask");
    await sleep(500);
    const question = `Is the new nursery variety from Baramati good for my land? (${Date.now().toString(36)})`;
    await phone.type("[role=dialog] input", question);
    await phone.evaluate(() => [...document.querySelectorAll("[role=dialog] form")].at(-1)?.requestSubmit());
    const arrived = await desk.waitForFunction((q) => document.body.textContent?.includes(q), { timeout: 10000, polling: 200 }, question).then(() => true, () => false);
    relay.push({ name: "relay: escalation reaches the desk on another profile", ok: arrived });
    if (arrived) {
      await desk.evaluate((q) => {
        const item = [...document.querySelectorAll("li")].find((li) => li.textContent?.includes(q));
        const input = item?.querySelector("input");
        if (!input) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, "Do not mix them. Spray copper alone at 06:00; fertiliser by drip two days later.");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        item.querySelector("form")?.requestSubmit();
      }, question);
      const replied = await phone.waitForFunction(() => document.body.textContent?.includes("Do not mix them"), { timeout: 10000, polling: 200 }).then(() => true, () => false);
      relay.push({ name: "relay: officer's reply reaches the phone", ok: replied });
    }

    // Sale slip: read on the phone with on-device OCR, checked, filed and disputed; the desk sees both.
    await phone.evaluate(() => [...document.querySelectorAll("[role=dialog] button[aria-label='Close']")].at(-1)?.click());
    await sleep(600);
    await clickText(phone, "button", "Check a sale slip");
    await sleep(500);
    await clickText(phone, "[role=dialog] button", "A slip with extra charges");
    const read = await phone.waitForFunction(() => /read on this phone in [0-9.]+ s/.test(document.body.textContent ?? ""), { timeout: 60000, polling: 200 }).then(() => true, () => false);
    const slipText = await textOf(phone, "[role=dialog]");
    if (process.env.SMOKE_DEBUG) console.log("slip dialog:", read, slipText.slice(150, 900));
    relay.push({ name: "slip: OCR on the phone finds ₹1,863 above the rate card", ok: read && slipText.includes("₹1,863"), detail: slipText.match(/read on this phone in [0-9.]+ s/)?.[0] ?? slipText.slice(0, 160) });
    await clickText(phone, "[role=dialog] button", "File in my record");
    await clickText(phone, "[role=dialog] button", "Send to the officer");
    const rippled = await desk.waitForFunction(() => document.body.textContent?.includes("Sale slip of 12 NOV read and checked"), { timeout: 10000, polling: 200 }).then(() => true, () => false);
    relay.push({ name: "slip: filing ripples to the desk over the relay", ok: rippled });
    const inboxed = await desk.waitForFunction(() => [...document.querySelectorAll("li")].some((li) => li.textContent?.includes("Sale slip") && li.textContent?.includes("Please refund ₹1,863")), { timeout: 10000, polling: 200 }).then(() => true, () => false);
    relay.push({ name: "slip: dispute lands in the desk inbox with slip replies", ok: inboxed });
  } catch (err) {
    relay.push({ name: "relay run completed", ok: false, detail: String(err).slice(0, 200) });
  } finally {
    await browser2.close();
    // Leave the relay clean for the next run or the live demo.
    await fetch(`${BASE}/api/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "reset", from: "smoke" }) }).catch(() => {});
  }
  for (const r of relay) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  ·  ${r.detail}` : ""}`);
  if (relay.some((r) => !r.ok)) process.exitCode = 1;
}
