// Renders the report's diagrams (Mermaid, themed like the prototype) and charts (SVG) to PNG.
// Usage: node scripts/report/figures.mjs   (needs network for Mermaid from jsDelivr)
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = resolve(root, "docs/report/figures");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(OUT, { recursive: true });

const stats = JSON.parse(readFileSync(resolve(root, "docs/data/season-stats.json"), "utf8"));
const bt = JSON.parse(readFileSync(resolve(root, "docs/data/backtest.json"), "utf8"));

const INK = "#1c1a17", INK2 = "#4a4640", INK3 = "#7a756c", PAPER = "#f4f5f0", SLIP = "#f6edc9", STAMP = "#4a3aa8", ALERT = "#c8102e", WATER = "#2c68a8", ROSE = "#b84a5e", RULE = "#d9d6cc";
const SANS = "'Segoe UI', Arial, sans-serif", MONO = "'Courier New', monospace", DEVA = "'Nirmala UI', sans-serif";

const THEME = `%%{init: {"theme":"base","themeVariables":{"background":"${PAPER}","primaryColor":"${SLIP}","primaryTextColor":"${INK}","primaryBorderColor":"${INK}","lineColor":"${INK2}","secondaryColor":"#ece6fb","tertiaryColor":"${PAPER}","fontFamily":"Segoe UI, Arial","fontSize":"17px","clusterBkg":"#ebe6d6","clusterBorder":"${INK3}","edgeLabelBackground":"${PAPER}","actorBkg":"${SLIP}","actorBorder":"${INK}","actorTextColor":"${INK}","noteBkgColor":"#ece6fb","noteBorderColor":"${STAMP}","noteTextColor":"${INK}","signalColor":"${INK}","signalTextColor":"${INK}","labelBoxBkgColor":"${SLIP}","sequenceNumberColor":"#ffffff","taskBkgColor":"#d6d0f2","taskBorderColor":"${STAMP}","taskTextColor":"${INK}","taskTextDarkColor":"${INK}","taskTextOutsideColor":"${INK}","critBkgColor":"#f0c2ca","critBorderColor":"${ALERT}","sectionBkgColor":"${SLIP}","altSectionBkgColor":"${PAPER}","sectionBkgColor2":"#ebe6d6","gridColor":"${RULE}","todayLineColor":"${ALERT}","stateBkg":"${SLIP}","stateBorder":"${INK}","transitionColor":"${INK2}"},"flowchart":{"curve":"basis","htmlLabels":true,"padding":14,"wrappingWidth":560},"sequence":{"mirrorActors":false,"actorMargin":56,"width":120,"boxMargin":8,"noteMargin":10,"messageMargin":34},"gantt":{"barHeight":24,"barGap":6,"fontSize":15,"sectionFontSize":15,"leftPadding":110,"useWidth":1050}}}%%`;

const DIAGRAMS = {
  "d-architecture": `flowchart TB
  X[("<b>Open data</b><br/>Open-Meteo: archive, forecast, ensemble,<br/>wind grid, elevation · OpenStreetMap")]
  S["<b>Next.js server</b><br/>/api/weather · /api/weather/wind<br/>/api/weather/ensemble · /api/prices<br/>/api/sync: idempotent relay, last writer wins"]
  B["<b>The same engine in every browser</b><br/>season engine: blight, water, harvest, markets, runs<br/>72-hour spread forecast: ensemble, storm brush"]
  PH["<b>Farmer phone</b><br/>kundli wheel and record<br/>Scan Lens and slip OCR on the device<br/>outbox in IndexedDB"]
  DK["<b>Taluka desk</b><br/>survey map, wind and forecast<br/>register, inbox, plot records"]
  X --> S --> B
  B --> PH
  B --> DK
  PH <-->|"overrides · questions · slips"| S
  S <-->|"server-sent events"| DK`,
  "d-ripple": `sequenceDiagram
  actor S as Sunita
  participant P as Phone
  participant O as Outbox
  participant R as Relay
  participant D as Desk
  S->>P: Photographs a leaf
  Note over P: Scan Lens runs on the device
  P->>O: Scan, stamped by the clock
  Note over P,O: Offline · 1 to send
  O->>R: Sent when signal returns
  R-->>D: Server-sent event
  Note over R,D: Season regenerated: spray set,<br/>neighbours warned, radar redrawn,<br/>her grade B, not C`,
  "d-slip": `flowchart TB
  P[Photo of the patti] --> T["OCR on the phone: English, then Marathi if needed"]
  T --> N["Normalise: Devanagari digits, separators, joiners"]
  N --> R["Parse: crates, weight, rate, gross, charges, total, net"]
  R --> X["Correct only self-proving lines; leave unreadable numbers blank"]
  X --> C["Check: arithmetic, the agreed rate card, the day's modal price"]
  C --> U["Ledger and red pen rings: the farmer confirms"]
  U --> F[File the sale in the record]
  U --> Q[Send the dispute to the officer]`,
  "d-target": `flowchart TB
  E["<b>Phones and kiosks</b><br/>farmer app with outbox and on-device models<br/>feature phones by IVR and SMS · WhatsApp · driver app"]
  C["<b>KhetKundli core</b><br/>API gateway: accounts and consent<br/>Postgres + PostGIS + H3: append-only plot events<br/>projections: radar, wave, water, runs · realtime channel"]
  M["<b>Models</b><br/>spread forecast, fitted, with ensembles<br/>harvest and price forecasts · run optimiser<br/>Sentinel-2 plot health"]
  X[("<b>Open data, by scheduled jobs</b><br/>Open-Meteo · Copernicus · Agmarknet · India-WRIS")]
  E <-->|"events · consent · live updates"| C
  C <--> M
  X --> M
  X --> C`,
  "d-gantt": `gantt
  dateFormat YYYY-MM-DD
  axisFormat %b %Y
  section H0 Demo
  Real-phone rehearsal, agronomy review        :h0, 2026-10-21, 2026-11-02
  section H1 Pilot
  Accounts, consent, event store               :h1a, 2026-11-03, 45d
  Server sync and SMS fallback                 :h1b, after h1a, 30d
  Pomegranate photo campaign                   :h1c, 2026-11-10, 75d
  Scan Lens v2, pomegranate on the NPU         :h1d, after h1c, 40d
  Marathi voice, WhatsApp and IVR              :h1e, 2026-12-01, 70d
  Real pattis and FPO rate cards               :h1f, 2026-12-15, 50d
  Forecast fitting on real reports             :h1g, 2027-01-15, 60d
  Ambia bahar pilot season                     :crit, h1p, 2027-01-15, 2027-06-30
  section H2 Taluka
  Sentinel-2 plot health                       :h2a, 2027-04-01, 75d
  Groundwater passbook                         :h2b, 2027-05-01, 75d
  Harvest and price forecasting                :h2c, 2027-06-01, 90d
  Run optimiser and driver app                 :h2d, 2027-07-01, 90d
  Export record, AnarNet-ready                 :h2e, 2027-09-01, 60d
  Mrig bahar at taluka scale                   :crit, h2p, 2027-06-01, 2028-01-31
  section H3 Platform
  Other talukas, more crops                    :h3a, 2028-02-01, 180d`,
  "d-impact": `flowchart TB
  I["<b>Inputs</b><br/>open weather, map and elevation data · farmers' phones · FPO and officer time"]
  A["<b>Activities</b><br/>keep the plot record · scan, ask, check slips · forecast and advise · plan pickings and runs"]
  O["<b>Outputs</b><br/>scans reported · advisories delivered · runs filled · slips checked"]
  U["<b>Outcomes</b><br/>sprays that stick · earlier warning downwind · water left in the ground · fair deductions, fuller trucks"]
  M["<b>Impact</b><br/>less crop lost to blight · higher net income · a protected aquifer"]
  I --> A --> O --> U --> M`,
};

// ---------- charts (SVG strings) ----------
const svgWrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="background:${PAPER};font-family:${SANS}">${body}</svg>`;
const fmt = (n) => n.toLocaleString("en-IN");

function chartSeason() {
  const W = 1100, H = 420, m = stats.weather, names = ["JUN", "JUL", "AUG", "SEP", "OCT*"];
  const panel = (x0, title, values, max, color, unit) => {
    const pw = 470, ph = 280, y0 = 70, bw = 62;
    let s = `<text x="${x0}" y="40" font-size="20" font-weight="700" fill="${INK}">${title}</text>`;
    for (let k = 0; k <= 4; k++) { const y = y0 + ph - (ph * k) / 4; s += `<line x1="${x0}" x2="${x0 + pw}" y1="${y}" y2="${y}" stroke="${RULE}" stroke-width="1"/><text x="${x0 - 8}" y="${y + 5}" font-size="13" text-anchor="end" fill="${INK3}" font-family="${MONO}">${Math.round((max * k) / 4)}</text>`; }
    values.forEach((v, i) => {
      const h = (v / max) * ph, x = x0 + 30 + i * 90;
      s += `<rect x="${x}" y="${y0 + ph - h}" width="${bw}" height="${Math.max(h, 0.5)}" rx="4" fill="${color}"/>`;
      s += `<text x="${x + bw / 2}" y="${y0 + ph - h - 8}" font-size="15" font-weight="700" text-anchor="middle" fill="${INK}" font-family="${MONO}">${v}${unit}</text>`;
      s += `<text x="${x + bw / 2}" y="${y0 + ph + 24}" font-size="14" font-weight="600" text-anchor="middle" fill="${INK2}">${names[i]}</text>`;
    });
    return s;
  };
  const body = panel(60, "Rain recorded at Phaltan, mm", m.map((x) => x.rainMm), 300, WATER, "") + panel(610, "Blight days (12 h or more of wet canopy)", m.map((x) => x.blightDays), 16, ROSE, "")
    + `<text x="60" y="${H - 18}" font-size="13" fill="${INK3}">Open-Meteo archive (ERA5-based reanalysis), 1 June to ${stats.recordedThrough}. *October to the 19th.</text>`;
  return svgWrap(W, H, body);
}

function chartFarmerShare() {
  const rows = [["Banana", 31], ["Tomato", 33], ["Grapes", 35], ["Onion", 36], ["Potato", 37], ["Mango", 43]];
  const W = 1100, H = 380, x0 = 170, pw = 820, y0 = 30, bh = 34, gap = 16;
  let s = "";
  [0, 25, 50, 75, 100].forEach((v) => { const x = x0 + (pw * v) / 100; s += `<line x1="${x}" x2="${x}" y1="${y0 - 6}" y2="${y0 + rows.length * (bh + gap)}" stroke="${RULE}"/><text x="${x}" y="${y0 + rows.length * (bh + gap) + 20}" font-size="13" text-anchor="middle" fill="${INK3}" font-family="${MONO}">${v}%</text>`; });
  rows.forEach(([name, v], i) => {
    const y = y0 + i * (bh + gap);
    s += `<text x="${x0 - 14}" y="${y + bh / 2 + 6}" font-size="17" text-anchor="end" fill="${INK}" font-weight="600">${name}</text>`;
    s += `<rect x="${x0}" y="${y}" width="${(pw * v) / 100}" height="${bh}" rx="4" fill="${ROSE}"/>`;
    s += `<rect x="${x0 + (pw * v) / 100 + 2}" y="${y}" width="${pw - (pw * v) / 100 - 2}" height="${bh}" rx="4" fill="#e6e1d4"/>`;
    s += `<text x="${x0 + (pw * v) / 100 - 10}" y="${y + bh / 2 + 6}" font-size="16" font-weight="700" text-anchor="end" fill="#ffffff" font-family="${MONO}">${v}%</text>`;
  });
  s += `<text x="${x0}" y="${H - 14}" font-size="13" fill="${INK3}">Farmer's share of the rupee the consumer pays (rose); the rest goes to the chain (grey). RBI working papers, 2024.</text>`;
  return svgWrap(W, H, s);
}

function chartBacktest() {
  const W = 1100, H = 430, y0 = 64, ph = 280;
  let s = "";
  const panel = (x0, pw, title, items, lo, hi, ticks) => {
    const Y = (v) => y0 + ph - ((v - lo) / (hi - lo)) * ph;
    s += `<text x="${x0}" y="36" font-size="20" font-weight="700" fill="${INK}">${title}</text>`;
    ticks.forEach((v) => { s += `<line x1="${x0}" x2="${x0 + pw}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0.5 ? INK2 : RULE}" stroke-dasharray="${v === 0.5 ? "5 4" : ""}"/><text x="${x0 - 8}" y="${Y(v) + 5}" font-size="13" text-anchor="end" fill="${INK3}" font-family="${MONO}">${v.toFixed(2)}</text>`; });
    s += `<text x="${x0 + pw + 6}" y="${Y(0.5) + 4}" font-size="12" fill="${INK2}">chance</text>`;
    items.forEach(({ x, v, c, label, sub, small }) => {
      s += `<line x1="${x}" x2="${x}" y1="${Y(0.5)}" y2="${Y(v)}" stroke="${c}" stroke-width="${small ? 4 : 6}" stroke-linecap="round"/><circle cx="${x}" cy="${Y(v)}" r="${small ? 9 : 12}" fill="${c}" stroke="${PAPER}" stroke-width="3"/>`;
      s += `<text x="${x}" y="${Y(v) + (v >= 0.5 ? -20 : 32)}" font-size="${small ? 14 : 16}" font-weight="700" text-anchor="middle" fill="${INK}" font-family="${MONO}">${v.toFixed(small ? 2 : 3)}</text>`;
      if (label) s += `<text x="${x}" y="${y0 + ph + 26}" font-size="13" font-weight="600" text-anchor="middle" fill="${INK2}">${label}</text>`;
      if (sub) s += `<text x="${x}" y="${y0 + ph + 43}" font-size="12" text-anchor="middle" fill="${INK3}">${sub}</text>`;
    });
  };
  panel(70, 430, "Skill above chance, whole season", [
    { x: 140, v: bt.auc.distanceOnly, c: INK3, label: "Distance only" },
    { x: 290, v: bt.auc.forecast, c: STAMP, label: "Spread forecast" },
    { x: 440, v: bt.auc.oracleAllSymptomatic, c: ROSE, label: "Oracle", sub: "every case reported" },
  ], 0.4, 0.7, [0.4, 0.5, 0.6, 0.7]);
  const months = bt.byMonth;
  panel(640, 410, "By month", months.flatMap((mo, i) => [
    { x: 700 + i * 140, v: mo.distanceOnly, c: INK3, small: true },
    { x: 744 + i * 140, v: mo.forecast, c: STAMP, small: true, label: "" },
  ]), 0.4, 0.7, [0.4, 0.5, 0.6, 0.7]);
  months.forEach((mo, i) => { s += `<text x="${722 + i * 140}" y="${y0 + ph + 26}" font-size="14" font-weight="600" text-anchor="middle" fill="${INK2}">${mo.month}</text>`; });
  s += `<circle cx="647" cy="${H - 27}" r="7" fill="${INK3}"/><text x="660" y="${H - 22}" font-size="13" fill="${INK2}">Distance only</text><circle cx="787" cy="${H - 27}" r="7" fill="${STAMP}"/><text x="800" y="${H - 22}" font-size="13" fill="${INK2}">Spread forecast</text>`;
  s += `<text x="70" y="${H - 22}" font-size="13" fill="${INK3}">ROC AUC; ${bt.pairs.toLocaleString("en-IN")} cell-days, ${bt.window.first} to ${bt.window.last}; reports 8–24 days later.</text>`;
  return svgWrap(W, H, s);
}

function chartSlip() {
  // The extra-charges specimen slip: gross down to net, the overcharge in red.
  const steps = [["Gross", 74340, 0], ["Commission 8%", 5947, 1487], ["Hamali ₹7/crate", 441, 126], ["Weighment", 63, 0], ["Freight", 1512, 0], ["Misc. kharch", 250, 250]];
  const W = 1100, H = 400, x0 = 210, pw = 840, y0 = 24, bh = 30, gap = 12, max = 74340;
  const X = (v) => x0 + (v / max) * pw;
  let s = "", run = 74340;
  steps.forEach(([name, v, extra], i) => {
    const y = y0 + i * (bh + gap);
    s += `<text x="${x0 - 14}" y="${y + bh / 2 + 6}" font-size="16" text-anchor="end" fill="${INK}" font-weight="600">${name}</text>`;
    if (i === 0) {
      s += `<rect x="${X(0)}" y="${y}" width="${X(v) - X(0)}" height="${bh}" rx="3" fill="${INK}"/><text x="${X(v) - 10}" y="${y + bh / 2 + 6}" font-size="15" font-weight="700" text-anchor="end" fill="#ffffff" font-family="${MONO}">₹${fmt(v)}</text>`;
      return;
    }
    const from = run - v; run = from;
    const fair = v - extra;
    s += `<rect x="${X(from)}" y="${y}" width="${Math.max(2, X(from + fair) - X(from))}" height="${bh}" fill="${INK3}"/>`;
    if (extra) s += `<rect x="${X(from + fair)}" y="${y}" width="${Math.max(3, X(from + v) - X(from + fair))}" height="${bh}" fill="${ALERT}"/>`;
    s += `<text x="${X(from) - 8}" y="${y + bh / 2 + 6}" font-size="14" text-anchor="end" fill="${INK2}" font-family="${MONO}">−₹${fmt(v)}${extra ? `  (₹${fmt(extra)} above card)` : ""}</text>`;
  });
  const yN = y0 + steps.length * (bh + gap);
  s += `<text x="${x0 - 14}" y="${yN + bh / 2 + 6}" font-size="16" text-anchor="end" fill="${STAMP}" font-weight="700">Net paid</text><rect x="${X(0)}" y="${yN}" width="${X(run) - X(0)}" height="${bh}" rx="3" fill="${STAMP}"/><text x="${X(run) - 10}" y="${yN + bh / 2 + 6}" font-size="15" font-weight="700" text-anchor="end" fill="#ffffff" font-family="${MONO}">₹${fmt(run)}</text>`;
  s += `<rect x="${x0}" y="${H - 40}" width="14" height="14" fill="${INK3}"/><text x="${x0 + 20}" y="${H - 28}" font-size="13" fill="${INK2}">Agreed on the rate card</text><rect x="${x0 + 210}" y="${H - 40}" width="14" height="14" fill="${ALERT}"/><text x="${x0 + 230}" y="${H - 28}" font-size="13" fill="${INK2}">Above the rate card: ₹1,863 to ask about</text>`;
  s += `<text x="${x0}" y="${H - 8}" font-size="12" fill="${INK3}">Specimen slip made for the demo (fictitious agent), read on the phone by OCR. Deductions drawn to scale.</text>`;
  return svgWrap(W, H, s);
}

function chartCalibration() {
  const W = 1100, H = 360;
  const groups = [["Plots ever infected by 20 Oct", stats.infectedByOct20.synthetic, stats.infectedByOct20.recorded, 100], ["Cells on warning, end of September", stats.warningEndSep.synthetic, stats.warningEndSep.recorded, 20]];
  let s = "";
  groups.forEach(([name, a, b, max], g) => {
    const x0 = 70 + g * 540, pw = 440, y0 = 60, ph = 220;
    s += `<text x="${x0}" y="34" font-size="19" font-weight="700" fill="${INK}">${name}</text>`;
    [0, 0.5, 1].forEach((k) => { const y = y0 + ph - ph * k; s += `<line x1="${x0}" x2="${x0 + pw}" y1="${y}" y2="${y}" stroke="${RULE}"/><text x="${x0 - 8}" y="${y + 5}" font-size="13" text-anchor="end" fill="${INK3}" font-family="${MONO}">${Math.round(max * k)}</text>`; });
    [[a, "Synthetic weather", INK3], [b, "Recorded 2026 weather", WATER]].forEach(([v, label, c], k) => {
      const x = x0 + 60 + k * 190, h = (v / max) * ph;
      s += `<rect x="${x}" y="${y0 + ph - h}" width="120" height="${h}" rx="4" fill="${c}"/><text x="${x + 60}" y="${y0 + ph - h - 8}" font-size="18" font-weight="700" text-anchor="middle" fill="${INK}" font-family="${MONO}">${v}</text><text x="${x + 60}" y="${y0 + ph + 24}" font-size="14" font-weight="600" text-anchor="middle" fill="${INK2}">${label}</text>`;
    });
  });
  s += `<text x="70" y="${H - 14}" font-size="13" fill="${INK3}">The same engine and seed, 192 plots: the drier recorded season (mean RH 73–77% against 79–82%) slows the spread.</text>`;
  return svgWrap(W, H, s);
}

function chartApproach() {
  // One record read together with the weather, and every action written back to it.
  const W = 1100, H = 480;
  let s = `<defs><marker id="p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK2}"/></marker><marker id="pw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${WATER}"/></marker><marker id="ps" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${STAMP}"/></marker></defs>`;
  const head = (x, t) => { s += `<text x="${x}" y="26" font-size="13" font-weight="700" fill="${STAMP}" font-family="${MONO}" letter-spacing="1">${t}</text>`; };
  head(20, "EACH PLOT'S RECORD"); head(360, "READ TOGETHER, WITH THE WEATHER"); head(860, "BACK TO THE PLOTS");
  const box = (x, y, w, t, sub, fill, stroke) => {
    s += `<rect x="${x}" y="${y}" width="${w}" height="70" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><text x="${x + 14}" y="${y + 29}" font-size="17" font-weight="700" fill="${INK}">${t}</text><text x="${x + 14}" y="${y + 52}" font-size="13.5" fill="${INK2}">${sub}</text>`;
  };
  const arrow = (x1, y1, x2, y2, c = INK2, m = "p") => { s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.2" marker-end="url(#${m})"/>`; };
  // Weather, top left.
  s += `<rect x="20" y="44" width="270" height="78" rx="5" fill="#dbe7f3" stroke="${WATER}" stroke-width="1.6"/><text x="34" y="72" font-size="17" font-weight="700" fill="${INK}">Weather</text><text x="34" y="94" font-size="13.5" fill="${INK2}">recorded hour by hour, live forecast,</text><text x="34" y="112" font-size="13.5" fill="${INK2}">wind field, 51-member ensemble</text>`;
  // The record: a ruled register card with a red margin.
  s += `<rect x="20" y="146" width="270" height="258" rx="5" fill="#ffffff" stroke="${INK}" stroke-width="1.6"/><line x1="50" y1="146" x2="50" y2="404" stroke="#d9706b" stroke-width="1.4"/><text x="60" y="176" font-size="17" font-weight="700" fill="${INK}">Kundli · gat 214</text>`;
  ["bahar date and crop stage", "scans and sprays", "irrigation", "pickings and grades", "sale slips"].forEach((t, i) => {
    const y = 214 + i * 40;
    s += `<line x1="20" y1="${y - 26}" x2="290" y2="${y - 26}" stroke="#a9c1d8" stroke-width="1"/><text x="60" y="${y}" font-size="14.5" fill="${INK}" font-family="${MONO}">${t}</text>`;
  });
  // Three lanes: disease, harvest, water.
  const lanes = [
    [126, ["Pest Radar", "where blight is reported"], ["72-hour spread forecast", "where wind and rain carry it"], ["Warn downwind", "spray on the first dry morning"]],
    [236, ["Harvest Wave", "which village picks which week"], ["Pooled runs", "planned days ahead"], ["Move a picking", "or a market, and fill the truck"]],
    [346, ["Water Commons", "water kept in the ground"], ["Village goal", "80% follow forecast irrigation"], ["Skip irrigation", "before forecast rain"]],
  ];
  lanes.forEach(([y, a, b, c]) => {
    box(360, y, 220, a[0], a[1], SLIP, INK);
    box(620, y, 210, b[0], b[1], "#ffffff", INK);
    box(860, y, 220, c[0], c[1], "#e4e0f6", STAMP);
    arrow(290, Math.min(Math.max(y + 35, 190), 390), 354, y + 35);
    arrow(580, y + 35, 614, y + 35);
    arrow(830, y + 35, 854, y + 35, STAMP, "ps");
  });
  // Weather into the forecast and the commons.
  s += `<path d="M290,83 L725,83 L725,120" fill="none" stroke="${WATER}" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#pw)"/><text x="470" y="75" font-size="13" fill="${WATER}">wind, rain and wet hours</text>`;
  // Everything done goes back into the record.
  s += `<path d="M970,416 L970,452 L155,452 L155,410" fill="none" stroke="${STAMP}" stroke-width="2.2" marker-end="url(#ps)"/><text x="562" y="444" font-size="13.5" text-anchor="middle" fill="${STAMP}">every advisory, picking and skipped irrigation is written back to the record</text>`;
  return svgWrap(W, H, s);
}

function chartBlight() {
  // Each plot's blight states; hand-drawn so the self-loop and the two-way arrow stay readable.
  const W = 1100, H = 340;
  let s = `<defs><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK2}"/></marker></defs>`;
  const st = (x, y, w, name, sub, fill, stroke) => {
    s += `<rect x="${x}" y="${y}" width="${w}" height="72" rx="36" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text x="${x + w / 2}" y="${y + 31}" font-size="19" font-weight="700" text-anchor="middle" fill="${INK}">${name}</text><text x="${x + w / 2}" y="${y + 54}" font-size="13" text-anchor="middle" fill="${INK2}" font-family="${MONO}">${sub}</text>`;
  };
  const arrow = (x1, y1, x2, y2) => { s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK2}" stroke-width="2.2" marker-end="url(#b)"/>`; };
  const label = (x, y, t, anchor = "middle") => { s += `<text x="${x}" y="${y}" font-size="14" text-anchor="${anchor}" fill="${INK}">${t}</text>`; };
  const Y = 96;
  st(20, Y, 160, "Protected", "hazard × 0.35", "#dbe7f3", WATER);
  st(330, Y, 160, "Healthy", "most plots", "#ffffff", INK);
  st(610, Y, 170, "Latent", "no symptoms yet", SLIP, INK);
  st(890, Y, 190, "Symptomatic", "can be scanned", "#f6d9de", ALERT);
  st(890, Y + 150, 190, "Treated", "spreads at a quarter", "#e4e0f6", STAMP);
  arrow(330, Y + 22, 186, Y + 22); label(258, Y + 12, "preventive spray");
  arrow(180, Y + 50, 324, Y + 50); label(252, Y + 74, "after 10 days");
  arrow(490, Y + 36, 604, Y + 36); label(547, Y + 10, "infection,"); label(547, Y + 26, "daily hazard");
  arrow(780, Y + 36, 884, Y + 36); label(832, Y + 26, "10 to 14 days");
  arrow(985, Y + 72, 985, Y + 144); label(975, Y + 104, "curative spray", "end"); label(975, Y + 120, "that sets", "end");
  s += `<path d="M940,${Y} C930,${Y - 70} 1040,${Y - 70} 1030,${Y - 4}" fill="none" stroke="${ALERT}" stroke-width="2.2" stroke-dasharray="6 4" marker-end="url(#b)"/>`;
  label(1080, Y - 62, "washed off by rain: repeat on the next dry morning", "end");
  s += `<text x="20" y="${H - 44}" font-size="13" fill="${INK3}">Daily hazard rises with wet-canopy hours, warmth and rain splash, and with symptomatic neighbours within 6 km,</text><text x="20" y="${H - 26}" font-size="13" fill="${INK3}">nearer and downwind counting more. The desk sees a plot only when it is scanned or visited.</text>`;
  return svgWrap(W, H, s);
}

function chartBusiness() {
  const W = 1100, H = 470;
  let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK2}"/></marker><marker id="am" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${STAMP}"/></marker></defs>`;
  const box = (x, y, w, h, title, lines, o = {}) => {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${o.fill ?? SLIP}" stroke="${o.stroke ?? INK}" stroke-width="1.5"/>`;
    s += `<text x="${x + 16}" y="${y + 30}" font-size="19" font-weight="700" fill="${o.ink ?? INK}">${title}</text>`;
    lines.forEach(([k, v], i) => {
      s += `<text x="${x + 16}" y="${y + 58 + i * 24}" font-size="13" font-weight="700" fill="${k === "Pays" ? ALERT : STAMP}" font-family="${MONO}">${k.toUpperCase()}</text><text x="${x + 70}" y="${y + 58 + i * 24}" font-size="15" fill="${INK2}">${v}</text>`;
    });
  };
  // Centre: the record.
  s += `<rect x="420" y="180" width="200" height="110" rx="6" fill="${INK}"/><text x="520" y="228" font-size="22" font-weight="700" text-anchor="middle" fill="${PAPER}">KhetKundli</text><text x="520" y="254" font-size="14" text-anchor="middle" fill="#cfcabd" font-family="${MONO}">one record per plot</text>`;
  box(20, 170, 300, 130, "Farmer", [["Gives", "scans, pickings, slips"], ["Gets", "advice, forecasts, checks"], ["Pays", "nothing: her record is hers"]], { fill: "#ffffff" });
  const right = [
    [20, "FPO", [["Gets", "desk, runs, fair-slip index"], ["Pays", "fee per member per season"], ["", "+ small fee per pooled crate"]]],
    [168, "Officer and KVK", [["Gets", "radar, forecast, inbox"], ["Pays", "programme funding per taluka"]]],
    [316, "Buyers and exporters", [["Gets", "lot passports, export check"], ["Pays", "traceability fee per lot"]]],
  ];
  right.forEach(([y, t, lines]) => box(730, y, 350, lines.length > 2 ? 134 : 116, t, lines.filter(([k]) => k !== "" ).concat([]), {}));
  // The FPO's second pays line, set under the first.
  s += `<text x="800" y="${20 + 58 + 48}" font-size="15" fill="${INK2}">+ small fee per pooled crate</text>`;
  // Farmer ↔ record.
  s += `<line x1="320" y1="215" x2="414" y2="215" stroke="${STAMP}" stroke-width="2.5" marker-end="url(#am)"/><line x1="414" y1="255" x2="326" y2="255" stroke="${INK2}" stroke-width="2.5" marker-end="url(#ah)"/>`;
  // Record ↔ the three who pay.
  [[87], [226], [374]].forEach(([cy]) => {
    s += `<path d="M620,${cy < 235 ? 215 : 265} C680,${cy < 235 ? 215 : 265} 670,${cy - 10} 724,${cy - 10}" fill="none" stroke="${INK2}" stroke-width="2.5" marker-end="url(#ah)"/>`;
    s += `<path d="M730,${cy + 14} C670,${cy + 14} 690,${cy < 235 ? 235 : 285} 626,${cy < 235 ? 235 : 285}" fill="none" stroke="${STAMP}" stroke-width="2.5" marker-end="url(#am)"/>`;
  });
  s += `<line x1="20" y1="${H - 52}" x2="56" y2="${H - 52}" stroke="${STAMP}" stroke-width="2.5" marker-end="url(#am)"/><text x="66" y="${H - 47}" font-size="14" fill="${INK2}">data and fees flow to the record</text><line x1="320" y1="${H - 52}" x2="356" y2="${H - 52}" stroke="${INK2}" stroke-width="2.5" marker-end="url(#ah)"/><text x="366" y="${H - 47}" font-size="14" fill="${INK2}">value flows back, in aggregate or with consent</text>`;
  s += `<text x="20" y="${H - 18}" font-size="13" fill="${INK3}">Fees are hypotheses to test in the pilot, not prices agreed with anyone.</text>`;
  return svgWrap(W, H, s);
}

const CHARTS = { "d-problem": chartApproach(), "d-blight": chartBlight(), "d-business": chartBusiness(), "c-season": chartSeason(), "c-farmer-share": chartFarmerShare(), "c-backtest": chartBacktest(), "c-slip": chartSlip(), "c-calibration": chartCalibration() };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;background:${PAPER}"><div id="o" style="display:inline-block;padding:18px;background:${PAPER};max-width:1100px"></div><script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script></body></html>`, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false }));
  for (const [name, code] of Object.entries(DIAGRAMS)) {
    await page.evaluate(async (src, id) => {
      const { svg } = await window.mermaid.render(id, src);
      const o = document.getElementById("o");
      o.innerHTML = svg;
      const el = o.querySelector("svg");
      // Render at natural size (Mermaid sets max-width), capped for very wide diagrams.
      const vb = el.viewBox.baseVal;
      const w = Math.min(1050, vb.width);
      el.style.maxWidth = "none";
      el.setAttribute("width", String(w));
      el.setAttribute("height", String((vb.height * w) / vb.width));
    }, `${THEME}\n${code}`, `m${name.replace(/\W/g, "")}`);
    const el = await page.$("#o");
    await el.screenshot({ path: `${OUT}/${name}.png` });
    console.log("diagram", name);
  }
  for (const [name, svg] of Object.entries(CHARTS)) {
    await page.evaluate((markup) => { document.getElementById("o").innerHTML = markup; }, svg);
    const el = await page.$("#o");
    await el.screenshot({ path: `${OUT}/${name}.png` });
    console.log("chart", name);
  }
} finally {
  await browser.close();
}
