// Renders the specimen sale slips (pattis) the slip reader offers as samples, styled like a phone
// photo of a computer-printed adat bill. Synthetic: the agent and the slip numbers are made up.
// Usage: node scripts/make-slips.mjs
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const inr = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEVA = "०१२३४५६७८९";
const deva = (s) => String(s).replace(/[0-9]/g, (d) => DEVA[Number(d)]);

const lot = { patti: "4127", date: "12/11/2026", farmer: "Sunita Jadhav, Taradgaon", crates: 63, kg: 1260, rate: 59, grade: "B" };
const gross = lot.kg * lot.rate;
const standard = [
  ["Commission (adat) 6%", Math.round(gross * 0.06)],
  [`Hamali ${lot.crates} x 5`, lot.crates * 5],
  [`Tolai (weighment) ${lot.crates} x 1`, lot.crates],
  [`Motor bhada (freight) ${lot.crates} x 24`, lot.crates * 24],
];
const SLIPS = [
  {
    file: "slip-fair",
    title: "A fair slip",
    lines: standard,
    tilt: -1.4,
    light: "radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,0.10), rgba(0,0,0,0.16))",
  },
  {
    file: "slip-extra",
    title: "A slip with extra charges",
    lines: [
      ["Commission (adat) 8%", Math.round(gross * 0.08)],
      [`Hamali ${lot.crates} x 7`, lot.crates * 7],
      [`Tolai (weighment) ${lot.crates} x 1`, lot.crates],
      [`Motor bhada (freight) ${lot.crates} x 24`, lot.crates * 24],
      ["Misc. kharch", 250],
    ],
    tilt: 1.1,
    light: "radial-gradient(110% 90% at 75% 15%, rgba(255,255,255,0.12), rgba(0,0,0,0.2))",
  },
  {
    // Marathi labels and Devanagari numerals; the net is printed ₹100 short of gross less deductions.
    file: "slip-marathi",
    title: "A Marathi slip",
    lang: "mr",
    netShort: 100,
    lines: [
      ["अडत ६%", Math.round(gross * 0.06)],
      [`हमाली ${deva(lot.crates)} x ५`, lot.crates * 5],
      [`तोलाई ${deva(lot.crates)} x १`, lot.crates],
      [`मोटार भाडे ${deva(lot.crates)} x २४`, lot.crates * 24],
    ],
    tilt: -0.8,
    light: "radial-gradient(120% 90% at 60% 10%, rgba(255,255,255,0.10), rgba(0,0,0,0.18))",
  },
];

const html = (s) => {
  const mr = s.lang === "mr";
  const n = (v) => (mr ? deva(inr(v)) : inr(v));
  const total = s.lines.reduce((a, [, v]) => a + v, 0);
  const net = gross - total - (s.netShort ?? 0);
  const row = (l, v, cls = "") => `<div class="row ${cls}"><span>${l}</span><span>${n(v)}</span></div>`;
  const head = mr
    ? `<h1 class="mrh">नमुना फळ व्यापारी</h1>
  <div class="c mr">अडत व्यापारी, गाळा क्र. १४, फलटण बाजार समिती</div>
  <div class="c mr">विक्री पट्टी</div>
  <div class="rule"></div>
  <div class="row mr"><span>पट्टी क्र.: ${deva(lot.patti)}</span><span>दिनांक: ${deva(lot.date)}</span></div>
  <div class="mr">शेतकरी: सुनीता जाधव, तरडगाव</div>
  <div class="row mr"><span>माल: डाळिंब (भगवा)</span><span>प्रत: ब</span></div>
  <div class="row mr"><span>क्रेट: ${deva(lot.crates)}</span><span>वजन: ${deva(lot.kg)} किलो</span><span>भाव: रु. ${deva(lot.rate)}.००/किलो</span></div>`
    : `<h1>SAMPLE FRUIT TRADERS</h1>
  <div class="c">Commission Agent, Shop 14, Phaltan APMC</div>
  <div class="c"><span class="mr">विक्री पट्टी</span> / SALE PATTI</div>
  <div class="rule"></div>
  <div class="row"><span>Patti No: ${lot.patti}</span><span>Date: ${lot.date}</span></div>
  <div>Farmer: ${lot.farmer}</div>
  <div class="row"><span>Commodity: Pomegranate (Bhagwa)</span><span>Grade: ${lot.grade}</span></div>
  <div class="row"><span>Crates: ${lot.crates}</span><span>Weight: ${lot.kg} kg</span><span>Rate: Rs ${lot.rate}.00/kg</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:900px;height:1240px;overflow:hidden;background:#3b3128}
  body{background:radial-gradient(140% 100% at 50% 0%,#5a4a3a,#2a221b)}
  .paper{position:absolute;left:95px;top:70px;width:690px;padding:44px 46px 40px;background:#f3efe4;
    transform:perspective(1600px) rotateX(3deg) rotate(${s.tilt}deg);box-shadow:0 22px 40px rgba(0,0,0,.45),0 2px 4px rgba(0,0,0,.3);
    font:22px/1.5 "Courier New",monospace;color:#262320;letter-spacing:.2px}
  .paper:after{content:"";position:absolute;inset:0;background:${s.light};pointer-events:none}
  h1{font:bold 30px/1.2 "Courier New",monospace;text-align:center;margin:0}
  h1.mrh{font:bold 30px/1.3 "Mangal","Nirmala UI",sans-serif}
  .c{text-align:center}.mr{font-family:"Mangal","Nirmala UI",sans-serif;font-size:22px}
  .row{display:flex;justify-content:space-between;gap:20px}
  .rule{border-top:2px dashed #555;margin:12px 0}
  .b{font-weight:bold}.small{font-size:16px;color:#555;text-align:center;margin-top:18px}
  ${mr ? ".paper{font-family:'Mangal','Nirmala UI',sans-serif}" : ""}
  </style></head><body><div class="paper">
  ${head}
  <div class="rule"></div>
  ${row(mr ? "एकूण रक्कम" : "Gross amount", gross, "b")}
  <div>${mr ? "वजावट:" : "Less:"}</div>
  ${s.lines.map(([l, v]) => row(l, v)).join("")}
  <div class="rule"></div>
  ${row(mr ? "एकूण वजावट" : "Total deductions", total)}
  ${row(mr ? "निव्वळ देय" : "NET PAYABLE", net, "b")}
  <div class="rule"></div>
  <div class="small">${mr ? "प्रात्यक्षिकासाठी नमुना पट्टी · " : ""}Specimen slip made for the KhetKundli demo</div>
  </div></body></html>`;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  // Twice the resolution: closer to a phone camera, and enough detail for Devanagari digits.
  await page.setViewport({ width: 900, height: 1240, deviceScaleFactor: 2 });
  for (const s of SLIPS) {
    await page.setContent(html(s), { waitUntil: "load" });
    // Frame the photo round the paper, as a farmer would.
    const box = await page.$eval(".paper", (el) => { const r = el.getBoundingClientRect(); return { y: r.bottom }; });
    const buf = await page.screenshot({ type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 900, height: Math.round(box.y + 60) } });
    writeFileSync(resolve(root, `public/samples/${s.file}.jpg`), buf);
    console.log(s.file, buf.length, "net", gross - s.lines.reduce((a, [, v]) => a + v, 0) - (s.netShort ?? 0));
  }
  writeFileSync(
    resolve(root, "public/samples/slips.json"),
    JSON.stringify(SLIPS.map((s) => ({ src: `/samples/${s.file}.jpg`, title: s.title, credit: "Specimen made for this demo; the agent is fictitious" })), null, 2) + "\n",
  );
} finally {
  await browser.close();
}
