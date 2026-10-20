// Builds docs/KhetKundli-Report.docx: the project report, styled like the prototype.
// node scripts/report/make-report.mjs   (from web/; run figures.mjs and frames.py first)
// Then scripts/report/finalize.ps1 fills the contents through Word and exports the PDF.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, HorizontalPositionRelativeFrom,
  ImageRun, LevelFormat, Packer, PageNumber, Paragraph, PositionalTab, PositionalTabAlignment,
  PositionalTabLeader, PositionalTabRelativeTo, ShadingType, Table, TableCell, TableLayoutType,
  TableOfContents, TableRow, TextRun, VerticalAlign, VerticalPositionRelativeFrom, WidthType,
  ExternalHyperlink,
} from "docx";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const FIG = path.join(ROOT, "docs/report/figures");
const OUT = path.join(ROOT, "docs/KhetKundli-Report.docx");
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/season-stats.json"), "utf8"));
const bt = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/backtest.json"), "utf8"));

// ── Palette and type, from DESIGN.md ──────────────────────────────────────────
const INK = "1C1A17", INK2 = "45413A", INK3 = "6F6A60", PAPER = "F4F5F0", PAPER2 = "E8EAE2";
const SLIP = "F6EDC9", SLIP_EDGE = "DCCB8E", STAMP = "4A3AA8", ALERT = "C8102E", WATER = "2C68A8";
const ROSE = "B84A5E", BALLPOINT = "1E40C8", RULE = "C9CDC0", BOARD_INK = "2F2512", BOARD_INK2 = "4F3F20";
const WHITE = "FFFFFF";
const SANS = "Segoe UI", HEAD = "Bahnschrift SemiBold Condensed", HEAD2 = "Bahnschrift SemiBold";
const MONO = "Courier New", DEV = "Nirmala UI", HAND = "Ink Free";
const BODY = 19; // half-points: 9.5 pt

// A4 with 0.75 in side margins.
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1080;
const W = PAGE_W - 2 * MARGIN; // content width, DXA
const PX = 15; // DXA per CSS pixel at 96 dpi
const WPX = Math.floor(W / PX);

// ── Sources, cited as [[key]] in the text ─────────────────────────────────────
const SOURCES = [
  ["nrcp", "ICAR-National Research Centre on Pomegranate, Solapur: Director's note on the crop's area, production and productivity (record area of 2.62 lakh ha projected for 2018-19).", "https://nrcpomegranate.icar.gov.in/DrNRCP", "via search index"],
  ["exports", "Ministry of Commerce figures for 2023-24 pomegranate exports (72,011 t, US$ 69.08 million), reported by The Tribune and DT Next on the first sea shipment to the USA, 2025.", "https://www.tribuneindia.com/news/business/apeda-sends-first-commercial-sea-shipment-of-pomegranates-to-usa/amp"],
  ["prev", "Survey of bacterial blight of pomegranate in western Maharashtra, Journal of Pharmacognosy and Phytochemistry 7(4), 2018: 20–88% average prevalence in four major growing districts.", "https://phytojournal.com/archives/2018/vol7issue4/PartAV/7-4-89-295.pdf", "via search index"],
  ["loss", "Reviews of bacterial blight of pomegranate, e.g. Journal of Pure and Applied Microbiology: 60–80% yield losses in epidemic years, first reported after the 1991 epidemic at IIHR, Bengaluru.", "https://microbiologyjournal.org/bacterial-blight-of-pomegranate-a-menace-in-quality-fruit-production/", "via search index"],
  ["jaem", "Journal of Agricultural Extension Management (2017): an extension worker to farmer ratio of about 1:5,000, against the national guideline of 1:1,100 (irrigated) and 1:750 (rainfed).", "https://epubs.icar.org.in/index.php/JAEM/article/download/78927/62768/491807", "via search index"],
  ["icrisat", "ICRISAT, Strengthening agri-extension for a strong farm sector: the ratio described as below 1:5,000.", "https://pressroom.icrisat.org/strengthening-agri-extension-for-a-strong-farm-sector", "via search index"],
  ["rbi", "Reserve Bank of India working papers on farmers' share in the consumer rupee (fruits; vegetables), 2024, and RBI press release.", "https://rbi.org.in/Scripts/PublicationsView.aspx?id=22721", "via search index"],
  ["iamai", "IAMAI and Kantar, Internet in India 2024, as reported by MediaNama (January 2025): 886 million active users, 488 million rural; 67% of rural users rely on shared devices.", "https://www.medianama.com/2025/01/223-rural-adoption-ai-india-internet-2024-kantar-iamai-report/", "via search index"],
  ["cgwb", "Central Ground Water Board, National Aquifer Mapping (NAQUIM) report, Satara district, Maharashtra: Phaltan among five semi-critical blocks; stage of extraction above 70% in six talukas including Phaltan; district 66.27%.", "https://cgwb.gov.in/sites/default/files/2022-11/naquim_satara_part_1_maharashtra.pdf", "via search index"],
  ["zp", "Zilla Parishad Satara, Phaltan taluka profile: 117,756 ha geographical area, 57,341 ha irrigated, 41,030 ha rainfed, 130 revenue villages.", "https://www.zpsatara.gov.in/?p=10991", "via search index"],
  ["meteo", "Open-Meteo: historical weather (ERA5-based reanalysis), forecast, ECMWF IFS 0.25° ensemble and elevation (Copernicus DEM GLO-90) APIs. Used live by the prototype.", "https://open-meteo.com/"],
  ["advisory", "ICAR-NRCP advisories 89 and 114 on bacterial blight: copper hydroxide 2 g/l or 1% Bordeaux mixture at 15-day intervals.", "https://nrcpomegranate.icar.gov.in/files/Advisory/89.pdf", "via search index"],
  ["apeda", "APEDA, pesticide annexure to the residue monitoring plan for pomegranate (corrected by NRC Pomegranate, 2016): copper compounds 2–2.5 g/l, pre-harvest interval 60 days.", "https://apeda.gov.in/apedahindi/Grapenet/annexure5rmpcorrected06012016bynrcpom.pdf", "via search index"],
  ["strep", "Down To Earth, Union agriculture ministry prohibits use of TB antibiotics on crops, 21 December 2021 (draft Prohibition of Streptomycin + Tetracycline in agriculture Order, 2021).", "https://www.downtoearth.org.in/agriculture/union-agriculture-ministry-prohibits-use-of-tb-antibiotics-on-crops-80785"],
  ["bacillus", "ICAR-NRCP, Possible biocontrol of bacterial blight in pomegranate using native endophytic Bacillus spp., Frontiers in Microbiology 15 (2024).", "https://doi.org/10.3389/fmicb.2024.1491124"],
  ["dpdp", "Government of India, Digital Personal Data Protection Act, 2023 (No. 22 of 2023).", null],
  ["h3", "H3: a hexagonal hierarchical geospatial index. Resolution 7 cells average about 5 km².", "https://h3geo.org/"],
  ["repo", "KhetKundli source code and documentation (README, PROBLEM, ARCHITECTURE, MODELS, DATA, ROADMAP, AGRONOMY).", "https://github.com/vizsh/KhetKundli"],
];
const SRC_NO = Object.fromEntries(SOURCES.map(([k], i) => [k, i + 1]));

// ── Runs ──────────────────────────────────────────────────────────────────────
const fontOf = (f, cs = DEV) => ({ ascii: f, hAnsi: f, eastAsia: f, cs });

function run(text, o = {}) {
  const size = o.size ?? BODY;
  return new TextRun({
    text,
    bold: o.bold, boldComplexScript: o.bold, italics: o.italics,
    color: o.color ?? INK, size, sizeComplexScript: o.csSize ?? size,
    font: fontOf(o.font ?? SANS, o.csFont ?? DEV),
    allCaps: o.caps, characterSpacing: o.spacing,
    superScript: o.sup, highlight: undefined,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    border: o.border ? { style: BorderStyle.SINGLE, size: o.borderSize ?? 6, color: o.border, space: 1 } : undefined,
    underline: o.underline,
  });
}

function cite(keys, base = {}) {
  const nos = keys.split(",").map((k) => {
    const n = SRC_NO[k.trim()];
    if (!n) throw new Error(`unknown source ${k}`);
    return n;
  });
  return run(`[${nos.join(", ")}]`, { ...base, sup: true, color: STAMP, bold: true, font: SANS });
}

// **bold**, *italic*, `typed`, [[source]]
function md(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(run(text.slice(last, m.index), base));
    const t = m[0];
    if (t.startsWith("**")) out.push(run(t.slice(2, -2), { ...base, bold: true }));
    else if (t.startsWith("`")) out.push(run(t.slice(1, -1), { ...base, font: MONO, size: (base.size ?? BODY) - 1 }));
    else if (t.startsWith("[[")) out.push(cite(t.slice(2, -2), base));
    else out.push(run(t.slice(1, -1), { ...base, italics: true }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(run(text.slice(last), base));
  return out;
}

const kids = (content, base) => (typeof content === "string" ? md(content, base) : content);

function P(content, o = {}) {
  return new Paragraph({
    children: kids(content, o),
    alignment: o.align,
    spacing: { before: o.before ?? 0, after: o.after ?? 110, line: o.line ?? 264 },
    keepNext: o.keepNext, keepLines: o.keepLines,
    indent: o.indent,
    numbering: o.numbering,
    border: o.pBorder,
    shading: o.pFill ? { type: ShadingType.CLEAR, fill: o.pFill, color: "auto" } : undefined,
    heading: o.heading,
    pageBreakBefore: o.pageBreakBefore,
  });
}

const bullets = (items, o = {}) => items.map((t, i) => P(t, { ...o, after: o.after ?? 50, numbering: { reference: o.ref ?? "dot", level: 0, instance: o.instance }, keepNext: o.keepNext && i < items.length - 1 }));
let listInstance = 0;
// o.continue keeps counting from the previous numbered list (two columns of one list).
const steps = (items, o = {}) => { if (!o.continue) listInstance += 1; return bullets(items, { ...o, ref: "num", instance: listInstance }); };
const arrows = (items, o = {}) => bullets(items, { ...o, ref: "arrow" });

// ── Images ────────────────────────────────────────────────────────────────────
function dims(buf) {
  if (buf[0] === 0x89) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const mk = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("unknown image");
}

const SCALE = {};
function img(file, widthPx, alt = "") {
  widthPx *= SCALE[file] ?? 1;
  const data = fs.readFileSync(path.join(FIG, file));
  const { w, h } = dims(data);
  const type = file.endsWith(".png") ? "png" : "jpg";
  return new ImageRun({ type, data, transformation: { width: Math.round(widthPx), height: Math.round((widthPx * h) / w) }, altText: { title: alt, description: alt, name: path.basename(file) } });
}

let figNo = 0;
function caption(text, o = {}) {
  figNo += 1;
  return P([run(`FIG. ${figNo}  `, { font: MONO, bold: true, size: 15, color: STAMP }), ...md(text, { size: 15, color: INK2 })], { align: o.align ?? AlignmentType.LEFT, after: o.after ?? 160, line: 240 });
}

function figure(file, widthPx, text, o = {}) {
  return [
    P([img(file, widthPx, text)], { align: AlignmentType.CENTER, after: 40, keepNext: true, line: 240 }),
    caption(text, { align: AlignmentType.CENTER, after: o.after }),
  ];
}

// ── Tables ────────────────────────────────────────────────────────────────────
const NONE = { style: BorderStyle.NONE, size: 0, color: "auto" };
const line = (color = RULE, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

function cell(children, width, o = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: { top: o.mt ?? 70, bottom: o.mb ?? 70, left: o.ml ?? 110, right: o.mr ?? 110 },
    borders: o.borders,
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    columnSpan: o.span,
  });
}

function table(rows, widths, o = {}) {
  return new Table({
    rows,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: o.borders ?? NO_BORDERS,
    alignment: o.align ?? AlignmentType.CENTER,
  });
}

// Ledger table: ink header, alternating paper rows, typed numbers.
function ledger(head, body, widths, o = {}) {
  const size = o.size ?? 17;
  const hdr = new TableRow({
    tableHeader: true, cantSplit: true,
    children: head.map((h, i) => cell(P(h, { font: HEAD2, size: size - 1, color: PAPER, after: 0, line: 240 }), widths[i], { fill: INK, mt: 60, mb: 60 })),
  });
  const rows = body.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((c, i) => {
      const mono = o.mono?.includes(i);
      const bold = o.boldFirst && i === 0;
      const paras = (Array.isArray(c) ? c : [c]).map((t) => (typeof t === "string" ? P(t, { size, font: mono ? MONO : SANS, bold, after: 20, line: 240 }) : t));
      return cell(paras, widths[i], { fill: ri % 2 ? PAPER2 : WHITE, mt: 50, mb: 50 });
    }),
  }));
  return table([hdr, ...rows], widths, { borders: { top: line(INK, 8), bottom: line(INK, 8), left: NONE, right: NONE, insideHorizontal: line(), insideVertical: line() } });
}

const stamp = (text, color = STAMP) => run(` ${text} `, { font: HEAD2, size: 13, color, border: color, caps: true, spacing: 10 });

// A slip: the yellow note the desk pins on top of a card.
function slip(label, content, o = {}) {
  const fill = o.fill ?? SLIP;
  const edge = o.edge ?? SLIP_EDGE;
  const paras = [];
  if (label) paras.push(P([stamp(label, o.stampColor ?? STAMP)], { after: 60 }));
  for (const c of content) paras.push(typeof c === "string" ? P(c, { after: 60, size: o.size }) : c);
  const b = line(edge, 6);
  return table([new TableRow({ cantSplit: o.cantSplit ?? true, children: [cell(paras, o.width ?? W, { fill, mt: 120, mb: 80, ml: 180, mr: 180, borders: { top: b, bottom: b, left: line(o.accent ?? edge, o.accent ? 24 : 6), right: b } })] })], [o.width ?? W]);
}

// Stat tiles: one big typed number, what it is, and where it comes from.
function tiles(items, o = {}) {
  const n = items.length;
  const gap = 140;
  const tw = Math.floor((W - gap * (n - 1)) / n);
  const widths = [];
  items.forEach((_, i) => { widths.push(tw); if (i < n - 1) widths.push(gap); });
  widths[widths.length - 1] += W - widths.reduce((a, b) => a + b, 0);
  const cells = [];
  items.forEach((it, i) => {
    const paras = [
      P([run(it.value, { font: HEAD, size: o.big ?? 46, color: it.color ?? INK }), ...(it.unit ? [run(` ${it.unit}`, { font: HEAD2, size: 18, color: INK2 })] : [])], { after: 20, line: 240 }),
      P(it.label, { size: 16, color: INK2, after: 50, line: 240 }),
      P([stamp(it.tag, it.tagColor ?? STAMP), ...(it.src ? [run(" "), cite(it.src, { size: 15 })] : [])], { after: 0, line: 240 }),
    ];
    cells.push(cell(paras, widths[cells.length], { fill: WHITE, mt: 90, mb: 90, ml: 130, mr: 110, borders: { top: line(it.color ?? INK, 18), bottom: line(RULE, 4), left: line(RULE, 4), right: line(RULE, 4) } }));
    if (i < n - 1) cells.push(cell(P(""), gap, { ml: 0, mr: 0 }));
  });
  return table([new TableRow({ cantSplit: true, children: cells })], widths);
}

// Side by side: [content, widthDXA] pairs, borderless.
function columns(cols, o = {}) {
  const widths = cols.map(([, w]) => w);
  const rest = W - widths.reduce((a, b) => a + (b || 0), 0);
  const free = cols.filter(([, w]) => !w).length;
  const ws = widths.map((w) => w || Math.floor(rest / free));
  ws[ws.length - 1] += W - ws.reduce((a, b) => a + b, 0);
  return table([new TableRow({ cantSplit: o.cantSplit ?? true, children: cols.map(([c], i) => cell(c, ws[i], { ml: i === 0 ? 0 : o.gap ?? 160, mr: i === cols.length - 1 ? 0 : o.gap ?? 160, mt: 0, mb: 0, valign: o.valign })) })], ws);
}

// A row of framed screenshots, each with its caption in the same cell so the two never part.
function gallery(items, o = {}) {
  const n = items.length;
  const cw = Math.floor(W / n);
  const widths = Array(n).fill(cw);
  widths[n - 1] += W - cw * n;
  const row = new TableRow({ cantSplit: true, children: items.map((it, i) => {
    figNo += 1;
    return cell([
      P([img(it.file, o.px ?? (cw / PX) - 8, it.caption)], { align: AlignmentType.CENTER, after: 40, line: 240 }),
      P([run(`FIG. ${figNo}  `, { font: MONO, bold: true, size: 14, color: STAMP }), run(it.title, { font: HEAD2, size: 16 })], { after: 20, line: 240, indent: { left: 80, right: 60 } }),
      P(it.caption, { size: 15, color: INK2, after: 0, line: 240, indent: { left: 80, right: 60 } }),
    ], widths[i], { ml: 20, mr: 20, mt: 0, mb: 40 });
  }) });
  return table([row], widths);
}

// A vertical pipeline of numbered steps, drawn in Word so it stays crisp at any zoom.
function pipeline(stepsList, width, o = {}) {
  const rows = [];
  stepsList.forEach(([title, text], i) => {
    rows.push(new TableRow({ cantSplit: true, children: [cell([
      P([run(`${i + 1}  `, { font: MONO, bold: true, size: 16, color: o.color ?? STAMP }), run(title, { font: HEAD2, size: 17 })], { after: text ? 10 : 0, line: 240 }),
      ...(text ? [P(text, { size: 15, color: INK2, after: 0, line: 240 })] : []),
    ], width, { fill: o.fills?.[i] ?? (i === stepsList.length - 1 ? SLIP : WHITE), mt: 60, mb: 60, ml: 140, mr: 120, borders: { top: line(o.edge ?? INK, 6), bottom: line(o.edge ?? INK, 6), left: line(o.color ?? STAMP, 24), right: line(o.edge ?? INK, 6) } })] }));
    if (i < stepsList.length - 1) rows.push(new TableRow({ cantSplit: true, children: [cell(P([run("↓", { size: 16, color: INK2, bold: true })], { align: AlignmentType.CENTER, after: 0, line: 200 }), width, { mt: 0, mb: 0 })] }));
  });
  return table(rows, [width]);
}

// ── Headings ──────────────────────────────────────────────────────────────────
let sectionNo = 0;
function section(title, marathi, lede, o = {}) {
  sectionNo += 1;
  const no = String(sectionNo).padStart(2, "0");
  const out = [
    P([run(` ${no} `, { font: MONO, bold: true, size: 22, color: PAPER, fill: INK }), run("   "), run(marathi, { font: DEV, size: 22, color: INK3 })], { before: o.newPage ? 0 : 260, after: 40, keepNext: true, line: 240, pageBreakBefore: o.newPage }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title })], keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: INK, space: 4 } } }),
  ];
  if (lede) out.push(P(lede, { size: 21, color: INK2, after: 140, line: 276, keepNext: true }));
  return out;
}
const h2 = (title, marathi) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: title }), ...(marathi ? [new TextRun({ text: `  ${marathi}`, font: fontOf(DEV), color: INK3, size: 22, bold: false })] : [])] });
const h3 = (title) => new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun({ text: title })] });

// ── Page furniture ────────────────────────────────────────────────────────────
function background(file) {
  const data = fs.readFileSync(path.join(FIG, file));
  return new ImageRun({
    type: file.endsWith(".png") ? "png" : "jpg", data,
    transformation: { width: 794, height: 1123 },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, allowOverlap: true, lockAnchor: true },
    altText: { title: "page", description: "page background", name: file },
  });
}

const rightTab = () => new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.NONE });

const bodyHeader = new Header({
  children: [new Paragraph({
    children: [
      background("bg-paper.png"),
      run("KhetKundli ", { font: HEAD2, size: 17 }), run("खेतकुंडली", { font: DEV, size: 15, color: INK3 }),
      new TextRun({ children: [rightTab()] }),
      run("PROJECT REPORT · 20 OCTOBER 2026", { font: MONO, size: 14, color: INK3 }),
    ],
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 4 } },
    spacing: { after: 0 },
  })],
});

const bodyFooter = new Footer({
  children: [new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
    children: [
      run("Team Outliers · Phaltan Hackathon, agriculture track · demo data synthetic, weather real", { font: MONO, size: 13, color: INK3 }),
      new TextRun({ children: [rightTab()] }),
      new TextRun({ children: ["PAGE ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: fontOf(MONO), size: 14, color: INK2, bold: true }),
    ],
  })],
});

const coverHeader = new Header({ children: [new Paragraph({ children: [background("bg-board.jpg")], spacing: { after: 0 } })] });

// ═════════════════════════════════════════════════════════════════════════════
// COVER
// ═════════════════════════════════════════════════════════════════════════════
const flip = (t, w) => cell(P([run(t, { font: MONO, bold: true, size: 40, color: WHITE })], { align: AlignmentType.CENTER, after: 0, line: 240 }), w, { fill: INK, mt: 40, mb: 40, ml: 60, mr: 60, valign: VerticalAlign.CENTER, borders: { top: line(BOARD_INK, 6), bottom: line(BOARD_INK, 6), left: line("CDA868", 30), right: line("CDA868", 30) } });

const cover = [
  columns([
    [[P([run("KhetKundli ", { font: HEAD2, size: 30, color: BOARD_INK }), run("खेतकुंडली", { font: DEV, size: 26, color: BOARD_INK2 })], { after: 0 })], 5200],
    [[P([run(" PROJECT REPORT ", { font: HEAD2, size: 16, color: BOARD_INK, border: BOARD_INK, borderSize: 12 }), run("   "), run(" TEAM OUTLIERS ", { font: HEAD2, size: 16, color: BOARD_INK, border: BOARD_INK, borderSize: 12 })], { align: AlignmentType.RIGHT, after: 0 })], 0],
  ]),
  P("", { after: 700 }),
  P([run("Every plot remembers.", { font: HEAD, size: 104, color: BOARD_INK })], { after: 0, line: 226 }),
  P([run("Every village sees together.", { font: HEAD, size: 104, color: BOARD_INK })], { after: 120, line: 226 }),
  P([run("प्रत्येक शेत लक्षात ठेवते. संपूर्ण गाव एकत्र पाहते.", { font: DEV, size: 34, color: BOARD_INK })], { after: 200 }),
  P([run("A living season record for every pomegranate plot in Phaltan taluka, and the collective sight that only many records read together can give. The problem and its scale, the gaps, our approach, the system we built and tested, its architecture, business model, feasibility and impact, and a realistic plan to take it to a pilot.", { size: 22, color: BOARD_INK2 })], { after: 260, line: 290 }),
  columns([
    [[table([new TableRow({ children: [flip("20", 900), flip("OCT", 1250), flip("2026", 1500)] })], [900, 1250, 1500], { align: AlignmentType.LEFT })], 3800],
    [[
      P([run("Status as of 20 October 2026.", { font: MONO, size: 16, color: BOARD_INK, bold: true })], { after: 30 }),
      P([run("Weather recorded at Phaltan to 19 October; live forecast, wind field and 51-member ensemble. Farmers, plots and sales in the demo are synthetic and labelled so.", { font: MONO, size: 15, color: BOARD_INK2 })], { after: 0, line: 240 }),
    ], 0],
  ], { valign: VerticalAlign.CENTER }),
  P("", { after: 160 }),
  P([img("frames/desk-storm-board.jpg", WPX + 20, "The taluka desk")], { align: AlignmentType.CENTER, after: 40, line: 240 }),
  P([run("The taluka desk on 20 October 2026: a demo storm in the 72-hour forecast, the live wind field drawn as rain strokes, and violet stipple where blight could travel.", { font: MONO, size: 15, color: BOARD_INK2 })], { align: AlignmentType.CENTER, after: 0, line: 240 }),
  P([run("TEAM OUTLIERS · PHALTAN HACKATHON, AGRICULTURE TRACK · SATARA, MAHARASHTRA", { font: HEAD2, size: 17, color: BOARD_INK, spacing: 20 })], { align: AlignmentType.CENTER, before: 360, after: 0, pBorder: { top: { style: BorderStyle.SINGLE, size: 12, color: BOARD_INK, space: 8 } } }),
];

// ═════════════════════════════════════════════════════════════════════════════
// CONTENTS
// ═════════════════════════════════════════════════════════════════════════════
function glance(items) {
  const cw = Math.floor(W / items.length);
  const widths = items.map((_, i) => (i === items.length - 1 ? W - cw * (items.length - 1) : cw));
  return table([new TableRow({ cantSplit: true, children: items.map(([k, v], i) => cell([P([stamp(k)], { after: 50, line: 240 }), P(v, { size: 16, after: 0, line: 250 })], widths[i], { fill: WHITE, mt: 90, mb: 90, ml: 130, mr: 110, borders: { top: line(INK, 18), bottom: line(RULE), left: line(RULE), right: line(RULE) } })) })], widths);
}

const inkRow = (sample, what, where) => new TableRow({ cantSplit: true, children: [cell(sample, 2600, { fill: WHITE }), cell(P(what, { size: 17, after: 0, line: 240 }), 3900, { fill: WHITE }), cell(P(where, { size: 16, color: INK2, after: 0, line: 240 }), W - 6500, { fill: WHITE })] });

const contents = [
  P([run("Contents", { font: HEAD, size: 56 }), run("   अनुक्रमणिका", { font: DEV, size: 26, color: INK3 })], { after: 60, pBorder: { bottom: { style: BorderStyle.SINGLE, size: 18, color: INK, space: 4 } } }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-1" }),
  P("", { after: 0, line: 200 }),
  P([run("At a glance", { font: HEAD2, size: 24 }), run("  थोडक्यात", { font: DEV, size: 18, color: INK3 })], { after: 60, keepNext: true }),
  glance([
    ["where", "**Phaltan taluka**, Satara district: 130 villages in the rain shadow east of the Sahyadri"],
    ["crop", "**Pomegranate**, Bhagwa, on drip; a Mrig bahar season with pickings from November"],
    ["for", "**Farmers** on shared phones, the **extension officer** and the **FPO** coordinator"],
    ["built", "A **farmer phone** and a **taluka desk** on recorded and live weather, tested end to end"],
  ]),
  P("", { after: 140 }),
  P([run("How to read this report", { font: HEAD2, size: 24 }), run("  हा अहवाल कसा वाचावा", { font: DEV, size: 18, color: INK3 })], { after: 60, keepNext: true }),
  P("The prototype marks where every line of its record came from, in three inks, and where every number comes from, with a stamp. This report does the same.", { after: 100, keepNext: true }),
  table([
    new TableRow({ tableHeader: true, children: ["Mark", "Means", "Where you will see it"].map((h, i) => cell(P(h, { font: HEAD2, size: 16, color: PAPER, after: 0 }), [2600, 3900, W - 6500][i], { fill: INK })) }),
    inkRow(P([run("Irrigation skipped", { font: MONO, size: 17 })], { after: 0 }), "**Typed**: computed by the engine from the record and the weather", "Register lines, forecasts, ripple lists"),
    inkRow(P([run("Sprayed at 15:00", { font: HAND, size: 22, color: BALLPOINT })], { after: 0 }), "**Ballpoint**: entered by a person (a scan, a spray, a question)", "The farmer's own entries"),
    inkRow(P([stamp("verified")], { after: 0 }), "**Stamped**: checked by an officer or a second source", "Officer visits, confirmed scans"),
    inkRow(P([stamp("live", WATER), run(" "), stamp("recorded", WATER)], { after: 0 }), "Real data: today's forecast, or the archive of what happened", "Weather, wind, ensemble, terrain, map"),
    inkRow(P([stamp("simulated", INK2)], { after: 0 }), "Synthetic demonstration data, labelled on every screen", "Farmers, plots, scans, sales, prices without a key"),
    inkRow(P([cite("prev")], { after: 0 }), "A published source, listed in Appendix B", "Every figure about the wider problem"),
  ], [2600, 3900, W - 6500], { borders: { top: line(INK, 8), bottom: line(INK, 8), left: NONE, right: NONE, insideHorizontal: line(), insideVertical: line() } }),
  P("", { after: 140 }),
  slip("in two minutes", [
    "**Read sections 01 and 05.** The summary says what KhetKundli is and what is real; the approach shows why one shared plot record, read together with the weather, answers six problems at once. Technical reviewers will find the models, their tests and the system in sections 07 and 08, and the plan to a real pilot in section 12.",
  ]),
];

// ═════════════════════════════════════════════════════════════════════════════
// 01 SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
const rainTotal = stats.weather.reduce((a, m) => a + m.rainMm, 0);
const summary = [
  ...section("Summary", "सारांश", "Phaltan's pomegranate farmers make six decisions each season that depend on things no single orchard can see. KhetKundli gives every plot a season record and reads the records together.", { newPage: true }),
  P("Phaltan taluka grows pomegranate on drip irrigation in the rain shadow east of the Sahyadri. Each season a farmer has to decide whether bacterial blight is moving towards her orchard, whether this evening's rain will wash off this morning's spray, whether tomorrow's rain makes tonight's irrigation a waste, which week to pick, how to get a small lot to market, and whether the commission agent's sale slip is right. Every one of those decisions depends on her neighbours' orchards and on the weather, and today she sees neither."),
  P("**KhetKundli** gives every plot a living season record, its *kundli*, kept on the farmer's phone in Marathi. Advice, leaf scans, voice questions, irrigation, pickings, transport and sale slips all write to the record and read from it. A **taluka desk** for the extension officer and the FPO reads all the records together with the weather and shows what only many plots can show: where blight is reported (**Pest Radar**), where wind-driven rain could carry it in the next 72 hours (**spread forecast**), which village will pick which week (**Harvest Wave**), how much groundwater stays in the ground (**Water Commons**), and which **pooled runs** to plan days ahead."),
  tiles([
    { value: `${rainTotal} mm`, label: "rain recorded at Phaltan, 1 June to 19 October 2026, drives the season hour by hour", tag: "recorded", tagColor: WATER, color: WATER },
    { value: "51", label: "ECMWF ensemble members behind each cell's chance of blight exposure", tag: "live", tagColor: WATER },
    { value: bt.auc.forecast.toFixed(3), label: `ROC AUC of the 72-hour forecast in the backtest, against ${bt.auc.distanceOnly.toFixed(3)} for distance alone`, tag: "simulated reports", tagColor: INK2, color: STAMP },
    { value: "₹1,863", label: "charged above the rate card, found by reading a specimen slip on the phone", tag: "on device", color: ALERT },
  ]),
  P("", { after: 60 }),
  h2("What is built and tested"),
  P("A working prototype with two linked surfaces, the farmer's phone and the taluka desk, that run the same season engine in the browser on **Phaltan's recorded 2026 weather**, with a live forecast, a live nine-point wind field over the taluka and real terrain. On the phone, a leaf scan, a voice question and a sale-slip check run **on the device**, and everything waits in an **offline outbox** until signal returns. On the desk, one tap warns the plots downwind of a blight report, and the whole season re-plans. 21 end-to-end checks run in real Chrome; the three specimen slips are read in tests; a backtest scores the forecast over the recorded season."),
  P("The demo follows **one leaf, one season, one sale**: Sunita scans a spotted leaf with no signal; her question about a failed spray is answered in Marathi from her own record; the scan reaches the desk, where the 72-hour forecast shows which plots to warn; a rain forecast re-plans irrigation and transport; and her sale slip is checked on the phone."),
  h2("What we ask for"),
  P("A pilot with **one farmer producer organisation, three villages and about 150 farmers** through the Ambia bahar of 2027 (January to June), so that every model gets its first field numbers. For that we need a plant pathologist to review the spray table and label photos, a pilot FPO willing to share its rate cards and run the desk weekly, field days for photo and slip collection, and SMS, WhatsApp and hosting accounts (section 12)."),
  slip("honest by design", [
    "The 192 farmers, their plots, scans, pickings and sales in the demo are **synthetic** and labelled SIMULATED on every screen. The weather, wind field, ensemble, terrain and map are **real**. No farmer interviews, pilots or partnerships exist yet: organisations named in this report are ones we intend to approach, and every target is a hypothesis to test.",
  ], { accent: STAMP }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 02 PROBLEM
// ═════════════════════════════════════════════════════════════════════════════
const persona = (name, role, job, today) => [
  P([run(name, { font: HAND, size: 26, color: BALLPOINT })], { after: 0, line: 240 }),
  P([run(role, { font: HEAD2, size: 16, color: INK2, caps: true })], { after: 60, line: 240 }),
  P([run("Needs  ", { font: MONO, size: 15, color: STAMP, bold: true }), ...md(job, { size: 17 })], { after: 50, line: 250 }),
  P([run("Today  ", { font: MONO, size: 15, color: ALERT, bold: true }), ...md(today, { size: 17 })], { after: 0, line: 250 }),
];

const PROBLEMS = [
  ["Blight spreads unseen", "Bacterial blight (*telya*, Xanthomonas axonopodis pv. punicae) moves between orchards in wind-driven rain splash. Once in an orchard it is very hard to clear, so the value is in warning the next one.", "A front that crosses village boundaries"],
  ["Sprays are wasted", "Copper needs a few dry hours to set. A spray at three in the afternoon before evening rain is money and chemical washed into the soil.", "Spray, labour and residue, for nothing"],
  ["Water is shared, used alone", "A plot is watered the day before 10 mm of rain, and the aquifer that the whole village draws on pays for it.", "A semi-critical block's groundwater"],
  ["Everyone picks the same week", "Crop stage decides harvest timing, so a village's orchards come due together, terminal markets glut and prices fall when most fruit arrives.", "Price, at the worst moment"],
  ["Transport is booked lot by lot", "Lots of 20 to 100 crates travel in half-empty vehicles because nobody knows a neighbour's picking date three days ahead.", "Freight per crate"],
  ["The sale slip is not checked", "The agent's *patti* lists gross, commission, hamali, weighment and freight. Few farmers check the arithmetic or compare the charges with what was agreed.", "Rupees on every sale"],
];

function problemGrid() {
  const cw = Math.floor((W - 2 * 140) / 3);
  const widths = [cw, 140, cw, 140, W - 2 * cw - 280];
  const card = (i) => {
    const [t, d, c] = PROBLEMS[i];
    return cell([
      P([run(` ${i + 1} `, { font: MONO, bold: true, size: 18, color: PAPER, fill: ALERT }), run("  "), run(t, { font: HEAD2, size: 20 })], { after: 70, line: 240 }),
      P(d, { size: 16, after: 70, line: 250 }),
      P([run("COSTS  ", { font: MONO, size: 14, color: ALERT, bold: true }), run(c, { size: 15, color: INK2, italics: true })], { after: 0, line: 240 }),
    ], cw, { fill: WHITE, mt: 100, mb: 100, ml: 130, mr: 130, borders: { top: line(ALERT, 12), bottom: line(RULE), left: line(RULE), right: line(RULE) } });
  };
  const gapCell = (w) => cell(P("", { after: 0 }), w, { ml: 0, mr: 0, mt: 0, mb: 0 });
  const row = (a) => new TableRow({ cantSplit: true, children: [card(a), gapCell(140), card(a + 1), gapCell(140), card(a + 2)] });
  const spacer = new TableRow({ children: widths.map((w) => cell(P("", { after: 0, size: 6, line: 120 }), w, { mt: 0, mb: 0, ml: 0, mr: 0 })) });
  return table([row(0), spacer, row(3)], widths);
}

const wet = stats.weather;
const blightJAS = wet.filter((m) => /-0[789]$/.test(m.month)).reduce((a, m) => a + m.blightDays, 0);
const problem = [
  ...section("The problem: one orchard cannot see the season", "समस्या", "Six problems a pomegranate farmer meets every season look separate. They have one cause: each plot's information is trapped in that plot."),
  h2("Where", "कुठे"),
  P("**Phaltan taluka**, Satara district, western Maharashtra, lies in the rain shadow east of the Sahyadri. Rain is modest and patchy, so most orchards run on drip from wells and the Nira canals. The hero crop is **pomegranate**, mostly the Bhagwa variety. Growers force flowering by withholding water and pruning, a practice called taking a **bahar**: Ambia flowers in January and February, Mrig in June and July, Hasta in September and October. KhetKundli follows a Mrig bahar season: bahar in June, fruit through the monsoon, pickings from November into January."),
  P(`The recorded 2026 season brought ${rainTotal} mm to 19 October. What matters for blight is not the total but the wet canopy: from July to September the canopy stayed wet ${wet[1].wetHoursMean} to ${wet[3].wetHoursMean} hours a day on average, and **${blightJAS} days** passed 12 hours, the weather in which the bacterium moves [[meteo]].`),
  ...figure("c-season.png", WPX - 10, "The recorded 2026 monsoon at Phaltan. Rain peaked in July, but blight weather (12 hours or more of wet canopy) kept rising into September."),
  h2("Who", "कोण"),
  columns([
    [persona("Sunita Jadhav", "Farmer · gat 214, Taradgaon · 1.5 acres on drip", "catch blight early, spray when it will stick, irrigate only when needed, pick and sell at the right time and place, be paid what was agreed", "advice is generic and in English; her history lives in her memory and a notebook; she cannot see her neighbours' orchards"), 0],
    [persona("The extension officer", "Agriculture department · KVK", "know where disease is moving and warn the right farmers before it arrives; answer questions", "hears of outbreaks late, by phone; far too many farmers to visit [[jaem]]"), 0],
    [persona("The FPO coordinator", "Farmer producer organisation", "plan transport and markets for many small lots; negotiate fair deductions with agents", "pickings and lot sizes are known only on the morning; transport is booked plot by plot"), 0],
  ], { gap: 140 }),
  P([run("Sunita is a synthetic persona, built from the problem statement; she is not a real person.", { size: 15, color: INK3, italics: true })], { before: 60, after: 120 }),
  P("Seen from one orchard, the six problems below look like six separate jobs for six separate apps: a disease app, a weather app, an irrigation schedule, a price portal, a transport booking and a calculator. Seen from the taluka, they are one problem, because each depends on what is happening on the neighbouring plots and in the weather over all of them."),
  h2("Six problems that are really one", "सहा समस्या, एक कारण"),
  problemGrid(),
  P("", { after: 100 }),
  slip("the common cause", ["**Each plot's information is trapped in that plot**, while the decisions that matter (warn, spray, irrigate, pick, pool, check) depend on many plots and on the weather together. No single-farmer app can fix that; a shared record can."], { accent: ALERT, stampColor: ALERT }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 03 SCALE
// ═════════════════════════════════════════════════════════════════════════════
const scale = [
  ...section("The scale of the problem", "व्याप्ती", "The problem is not local to one taluka. The crop, the disease, the shortage of extension staff, the thin share of the consumer's rupee and the shared phones are national patterns."),
  tiles([
    { value: "2.62 lakh", unit: "ha", label: "India's pomegranate area, a record projected for 2018-19; Maharashtra is the largest grower", tag: "sourced", src: "nrcp" },
    { value: "72,011", unit: "t", label: "pomegranates exported in 2023-24, worth US$ 69.08 million", tag: "sourced", src: "exports" },
    { value: "20–88%", label: "average prevalence of bacterial blight across four major districts of western Maharashtra", tag: "sourced", src: "prev", color: ALERT },
    { value: "60–80%", label: "yield loss reported for blight in epidemic years", tag: "sourced", src: "loss", color: ALERT },
  ], { big: 40 }),
  P("", { after: 140 }),
  tiles([
    { value: "1 : 5,000", label: "extension workers to farmers, against a guideline of 1 : 1,100 for irrigated areas", tag: "sourced", src: "jaem,icrisat", color: ALERT },
    { value: "31–43%", label: "of the consumer's rupee reaches farmers for banana, grapes and mango", tag: "sourced", src: "rbi", color: ROSE },
    { value: "67%", label: "of rural internet users rely on shared devices; rural India has 488 million of 886 million users", tag: "sourced", src: "iamai" },
    { value: "> 70%", label: "of Phaltan's annual groundwater recharge is drawn: a semi-critical block", tag: "sourced", src: "cgwb", color: WATER },
  ], { big: 40 }),
  P("", { after: 80 }),
  h2("What the numbers mean", "आकड्यांचा अर्थ"),
  P("**The disease is the biggest single risk to the crop.** Bacterial blight reached epidemic levels in Maharashtra and Karnataka in the 2000s; surveys in western Maharashtra found it in 20 to 88% of orchards on average across four districts [[prev]], and reviews report losses of 60 to 80% in epidemic years [[loss]]. Exports, which need residue-compliant spraying and traceable lots, were worth US$ 69 million in 2023-24 [[exports]]."),
  P("**People cannot be everywhere.** With about one extension worker for every 5,000 farmers [[jaem,icrisat]], an officer cannot visit orchards in time to stop a front moving with the rain. Warnings have to come from farmers' own reports and travel back to them as forecasts."),
  P("**The farmer keeps a third of the price.** The Reserve Bank's 2024 working papers put farmers' share of the consumer's rupee at about 31% for banana, 35% for grapes and 43% for mango [[rbi]]. Pomegranate was not studied, but it moves through the same commission agents and terminal markets. Gluts and unchecked deductions come out of that third."),
  ...figure("c-farmer-share.png", WPX - 30, "Farmer's share of the consumer's rupee for fruit and vegetables studied by the RBI in 2024 [[rbi]]. Pomegranate was not in the study."),
  h2("Phaltan taluka in numbers", "फलटण तालुका"),
  columns([
    [[ledger(["Measure", "Value", "Source"], [
      ["Geographical area", "117,756 ha", "Satara ZP [[zp]]"],
      ["Irrigated / rainfed", "57,341 / 41,030 ha", "Satara ZP [[zp]]"],
      ["Revenue villages", "130", "Satara ZP [[zp]]"],
      ["Groundwater", "semi-critical, > 70% drawn", "CGWB [[cgwb]]"],
      ["Rain, 1 Jun–19 Oct 2026", `${rainTotal} mm`, "Open-Meteo [[meteo]]"],
      ["Blight days, Jul–Sep 2026", `${blightJAS}`, "Open-Meteo [[meteo]]"],
    ], [2050, 1650, 1300], { mono: [1], size: 16 })], 5000],
    [[
      P("A taluka of **130 villages** with about 57,000 irrigated hectares is the right unit for KhetKundli: large enough that blight fronts, harvest waves and shared transport cross village boundaries, small enough for one officer's desk and one FPO's trucks."),
      P("Its groundwater is already **semi-critical** [[cgwb]], so every litre of irrigation skipped before rain is water the village keeps. And because **two-thirds of rural internet users share a phone** [[iamai]], the farmer app has to work for a household, in Marathi, by voice, and without signal."),
    ], 0],
  ]),
];

// ═════════════════════════════════════════════════════════════════════════════
// 04 GAPS
// ═════════════════════════════════════════════════════════════════════════════
const gaps = [
  ...section("The gaps in what exists", "उणिवा", "Each of the six problems has tools aimed at it. None of them shares a record, so none of them can see what many plots together reveal."),
  ledger(["What farmers have today", "What it misses", "What KhetKundli adds"], [
    ["District agromet advisories, a few times a week", "Not tied to the plot's stage, its last spray or the hour; no spray window", "Advice from the plot's own record and the hourly forecast: the first sprayable morning"],
    ["Photo-diagnosis apps", "One farmer, one photo; usually needs signal; the finding stays with that farmer", "Scan Lens on the device; a confirmed scan becomes a cell on the Pest Radar and a warning downwind"],
    ["Officer visits and phone calls", "About one officer per 5,000 farmers [[jaem]]; outbreaks heard of late", "The desk sees reports as they arrive, forecasts where they will go and warns in one tap, by app or SMS"],
    ["Mandi price portals", "Today's price, not next week's glut; no link to the village's harvest timing", "Harvest Wave: picking weeks forecast from crop stage on every plot"],
    ["Transport booked by each farmer", "Half-empty vehicles; nobody knows a neighbour's picking date", "Pooled runs planned days ahead from the wave; one QR passport per lot"],
    ["The agent's patti, taken on trust", "Few check the arithmetic or the charges; no agreed card to compare with", "The slip read on the phone and checked against arithmetic, the FPO's rate card and the day's modal price"],
    ["Apps for one owner, in English, always online", "Two-thirds of rural users share a phone [[iamai]]; signal fails in orchards", "Marathi first, voice in and out, an offline outbox, a record that belongs to the plot"],
  ], [2650, 3300, W - 5950], { boldFirst: true, size: 16 }),
  P("", { after: 100 }),
  columns([
    [[slip("the missing piece", ["Not another app, but a **shared plot record**: one event written once, by the farmer or the engine, and read by every module and, with consent and in aggregate, by the village."], { width: 4700, accent: STAMP })], 4700],
    [[
      P("**Why it has not been built.** A shared record only pays once many plots keep it, and plots keep it only if it pays the farmer on day one. KhetKundli is designed for both: every screen on the phone is useful alone (the spray window, the slip check, the scan, the answer from her own record), and every entry also feeds the collective layers.", { after: 0 }),
    ], 0],
  ], { valign: VerticalAlign.CENTER }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 05 APPROACH
// ═════════════════════════════════════════════════════════════════════════════
const PRINCIPLES = [
  ["One record, many faces", "Every feature reads from and writes to the plot record; nothing stands alone."],
  ["Collective sight", "Show what only many plots together reveal: the radar, the wave, the commons."],
  ["Prove, don't claim", "Real weather, real map, on-device models; everything simulated is labelled."],
  ["Act, don't label", "Every detection or forecast ends in an action with a time window."],
  ["Doses never come from a model", "Products and doses come from a fixed table that agronomists review."],
  ["The farmer's data stays hers", "Shared maps aggregate to about 5 km² cells; photos and slips are read on the phone."],
  ["Built for the field", "Marathi first, voice, offline, low-end and shared phones, bright sunlight."],
];

const approach = [
  ...section("Our approach: one record, read together", "दृष्टिकोन", "Give every plot a season record that every feature writes to and reads from. Then read the records together, with the weather."),
  ...figure("d-problem.png", WPX - 10, "Each plot's record feeds the collective layers; the layers send advisories and plans back to the plots."),
  slip("the key claim", ["**The crop-advisory layer is the demand forecast for the logistics layer**: crop stage on every plot predicts when each village will pick. And the disease layer is only as good as the reports flowing into it, which is why the farmer's phone has to be worth opening every day."], { accent: STAMP }),
  P("", { after: 60 }),
  h2("Principles", "तत्त्वे"),
  table(
    [0, 1, 2, 3].map((r) => new TableRow({ cantSplit: true, children: [0, 1].map((c) => {
      const i = r * 2 + c;
      const w = Math.floor(W / 2);
      if (i >= PRINCIPLES.length) {
        return cell([P([stamp("six problem statements", STAMP)], { after: 40 }), P("One record answers the six problem statements the hackathon combined: smart crop advisory, a personal farming assistant, gamified sustainable practice, farmer query support, on-device disease detection, and shared transport for small lots (table below).", { size: 16, after: 0, line: 250 })], w, { fill: SLIP, mt: 80, mb: 80, ml: 140, mr: 140 });
      }
      const [t, d] = PRINCIPLES[i];
      return cell(P([run(`${i + 1}  `, { font: MONO, bold: true, size: 20, color: STAMP }), run(t, { font: HEAD2, size: 19 }), run("   "), ...md(d, { size: 16, color: INK2 })], { after: 0, line: 250 }), w, { fill: i % 2 === (r % 2) ? WHITE : WHITE, mt: 80, mb: 80, ml: 140, mr: 140, borders: { top: NONE, bottom: line(RULE), left: NONE, right: NONE } });
    }) })),
    [Math.floor(W / 2), W - Math.floor(W / 2)],
    { borders: { top: line(INK, 8), bottom: line(INK, 8), left: NONE, right: NONE, insideHorizontal: line(), insideVertical: line(RULE) } },
  ),
  P("", { after: 100 }),
  h2("Six problem statements, one record", "सहा प्रश्न, एक नोंद"),
  ledger(["Source", "Problem statement", "KhetKundli module", "Where"], [
    ["Govt. of Punjab", "Smart crop advisory for small and marginal farmers", "Advice from the plot's own record and the live forecast", "Phone: today slip, spray window"],
    ["Govt. of Kerala", "AI-powered personal farming assistant", "The kundli wheel: one plot, one season, remembered", "Phone: wheel, record"],
    ["Govt. of Kerala", "Gamified platform for sustainable practices", "Water Commons: a shared village goal, not a leaderboard", "Desk: Water Commons"],
    ["Govt. of Kerala", "AI-based farmer query support", "Marathi voice questions answered from the record, escalated to the officer", "Phone: Ask; desk: inbox"],
    ["Qualcomm, ID 26257", "On-device detection of disease, pests and deficiencies", "Scan Lens: a leaf model that runs with no signal", "Phone: scan a leaf"],
    ["Team Outliers", "Uber for Harvest: shared transport for small lots", "Harvest Wave and pooled runs; the sale slip checked", "Desk: Wave, Runs; phone: slip"],
  ], [1500, 2700, 3300, W - 7500], { boldFirst: true, size: 16 }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 06 SOLUTION
// ═════════════════════════════════════════════════════════════════════════════
const solution = [
  ...section("The solution we built", "उपाय", "Two linked surfaces run one season engine on one clock: Sunita's phone, in Marathi, and the taluka desk, on a survey sheet of the taluka. A pitch page plays the season end to end."),
  h2("On the farmer's phone", "शेतकऱ्याचा फोन"),
  P("Sunita's phone keeps her plot's season and is worth opening every day on its own. Each feature below is built and runs in the demo."),
  ledger(["Feature", "What the farmer gets", "What is real"], [
    ["Kundli wheel and today slip", "The one thing to do today, and a 72-hour spray window from the hourly forecast; drag the dot to move through the season", "Recorded weather; live Open-Meteo forecast"],
    ["Scan Lens, with a photo check", "Photograph a leaf, get a finding with no signal and see where the model looked; the camera frame turns violet when the photo is sharp and lit", "MobileNetV2 in the browser, about 80 ms; pomegranate result scripted until trained"],
    ["Ask", "A Marathi or English voice question answered from her record with dates and amounts; anything else goes to the officer, whose reply is read aloud", "Web Speech API; answers built by code, never invented"],
    ["Works with no signal", "Scans, questions and slips wait in the phone's outbox and go in order when signal returns; the header says Synced, Sending or Offline · 2 to send", "IndexedDB outbox, hybrid logical clocks"],
    ["Share my season", "Her wheel and season summary as one image for WhatsApp", "Drawn on the phone"],
  ], [2200, 4900, W - 7100], { boldFirst: true, size: 16 }),
  P("", { after: 80 }),
  gallery([
    { file: "frames/phone-home.jpg", title: "Kundli wheel", caption: "The whole season on one dial; the real 2026 monsoon as rain ticks; today's one task." },
    { file: "frames/phone-ask.jpg", title: "Ask, in Marathi", caption: "\"Why did my last spray fail?\" answered from her own record, read aloud." },
    { file: "frames/phone-pulse.jpg", title: "Around my plot", caption: "Reported blight and the next 72 hours in the cells within 4 km; never a neighbour's plot." },
    { file: "frames/phone-passport.jpg", title: "Lot passport", caption: "One QR per picking: origin cell, sprays, water, run, export check." },
  ]),
  P("", { after: 80 }),
  columns([
    [[P([img("frames/kundli-card.jpg", 205, "Share card")], { align: AlignmentType.CENTER, after: 40 }), caption("The season share card, drawn on the phone at 1080 × 1350.", { align: AlignmentType.CENTER, after: 0 })], 3300],
    [[
      h3("Why a farmer opens it every day"),
      P("The collective layers need reports, and reports come only from a phone that is worth opening. Every phone screen pays on its own:"),
      ...bullets([
        "**A spray that sticks.** The spray window counts the dry hours after each morning, so the copper sets; the record remembers the one that washed off.",
        "**Rupees back on a slip.** The specimen slip with extra charges shows ₹1,863 above the agreed card, read in under two seconds on the phone.",
        "**Answers in her language.** The record answers in Marathi, by voice; the officer gets only what the record cannot answer.",
        "**A record to show.** The share card and lot passports turn the season into something she can show a buyer or a scheme officer.",
      ]),
      P("Nothing leaves the phone until she files it: the photo of a leaf or a slip is read on the device, and only the finding is shared, at cell level.", { after: 0 }),
    ], 0],
  ], { valign: VerticalAlign.CENTER }),
  P("", { after: 60 }),
  slip("marathi first", ["Every farmer-facing line has a Marathi twin, set in Devanagari with proper conjuncts; voice works in Marathi both ways; and slips written with Marathi labels and Devanagari digits are read and converted on the phone."], { accent: STAMP }),
  P("", { after: 60 }),
  h3("The sale slip, checked on the phone"),
  gallery([
    { file: "frames/phone-slip.jpg", title: "Photograph the patti", caption: "Every number read on the phone; overcharges ringed in red pen." },
    { file: "frames/phone-slip-ledger.jpg", title: "The ledger", caption: "Each line checked against arithmetic and the FPO's rate card." },
    { file: "frames/phone-slip-marathi.jpg", title: "A Marathi slip", caption: "Devanagari labels and digits read with the Marathi model, on demand." },
    { file: "frames/lot-passport.jpg", title: "What the buyer sees", caption: "The passport page, with the 60-day copper pre-harvest check [[apeda]]." },
  ]),
  P("", { after: 80 }),
  h2("At the taluka desk", "तालुका डेस्क"),
  ...figure("frames/desk-storm.jpg", WPX, "The desk on 20 October 2026. Pest Radar on the survey sheet, the live wind field as rain strokes, a demo storm in the 72-hour forecast and violet stipple where blight could travel. Right: the blight card, the daily register in three inks, and the plot record."),
  ledger(["Feature", "What the officer or FPO gets", "What is real"], [
    ["Pest Radar with a live wind field", "Reported blight by H3 cell (about 5 km²), freshness-weighted; the wind over the taluka now", "Nine-point live wind grid; reports simulated"],
    ["72-hour spread forecast", "Where reported blight can travel hour by hour, each cell's peak hour, and the cells to warn", "Live forecast or recorded weather for any past day"],
    ["How sure is it", "The same forecast run on all 51 ECMWF ensemble members: the chance of moderate exposure by cell, and the range of rain per hour", "Live Open-Meteo ensemble"],
    ["Warn downwind", "One tap sends a preventive advisory to the plots in the plume, by app or SMS, and the season re-plans", "Simulated outcome, shown as a ripple"],
    ["Storm brush", "Draw a storm's path and watch where it would carry blight: a what-if for training and planning", "The model, with a moving rain cell and gust front"],
    ["Survey sheet in relief", "25 m contours from real elevation; low-lying cells hold dew two hours longer in the forecast", "Copernicus DEM via Open-Meteo"],
  ], [2300, 4800, W - 7100], { boldFirst: true, size: 16 }),
  P("", { after: 100 }),
  gallery([
    { file: "frames/desk-storm-brush-crop.jpg", title: "Storm brush", caption: "A storm drawn from Adarki towards Nandal; the gust front bends the wind and the plume follows. A what-if: the warn button is disabled." },
    { file: "frames/desk-monsoon-crop.jpg", title: "Warn downwind, 19 September", caption: "18 cells on warning; an advisory to 88 cells downwind: 62 plots told, 52 sprays booked, new infections 14 → 11 (simulated)." },
  ]),
  P("", { after: 60 }),
  gallery([
    { file: "frames/desk-wave-crop.jpg", title: "Harvest Wave", caption: "Crates expected by village and week from crop stage on every plot, with Phaltan and Pune prices and the Pune glut ahead." },
    { file: "frames/desk-runs-crop.jpg", title: "Pooled runs", caption: "Runs from village collection points to Phaltan APMC and Pune, packed into 75-crate vehicles along the real road graph." },
  ]),
  P("", { after: 60 }),
  P("**The register and the inbox.** Beside the map, the desk keeps a daily register in three inks: typed lines computed by the engine, ballpoint lines entered by people, stamped lines verified. Questions the record cannot answer arrive in the inbox with the plot's last five entries, so the officer can reply without a phone call, and the reply is read aloud on the farmer's phone."),
  h2("One event, every module: the ripple", "एक घटना, सर्व विभाग"),
  ...figure("frames/pitch-ripple-crop.jpg", WPX, "The pitch page plays one season. Here the record remembers a spray washed off by 24 mm of recorded evening rain, and answers Sunita's question in Marathi."),
  columns([
    [[
      P("A judge, an officer or a farmer should see one event change everything it touches. When Sunita scans a spotted leaf with no signal:"),
      ...arrows([
        "the scan waits in her outbox, then reaches the desk in clock order when signal returns;",
        "the season regenerates from her record: a curative spray is set for the first dry, calm morning;",
      ], { after: 40 }),
    ], 0],
    [[
      ...arrows([
        "her neighbours within 2.5 km are warned, the radar is redrawn and the 72-hour plume moves;",
        "her grade at harvest is B, not C; the Harvest Wave, the pooled runs and her sale follow.",
      ], { after: 40 }),
      P("The desk lists the difference before and after as a ripple, in typed ink.", { after: 0 }),
    ], 0],
  ]),
];

// ═════════════════════════════════════════════════════════════════════════════
// 07 TECHNOLOGY AND MODELS
// ═════════════════════════════════════════════════════════════════════════════
const code = (lines, o = {}) => table([new TableRow({ cantSplit: true, children: [cell(lines.map((l) => P([run(l || " ", { font: MONO, size: o.size ?? 15, color: PAPER })], { after: 0, line: 240 })), o.width ?? W, { fill: INK, mt: 120, mb: 120, ml: 200, mr: 200 })] })], [o.width ?? W]);

const technology = [
  ...section("Technology and models", "तंत्रज्ञान", "One TypeScript codebase: pages, API routes and the season engine. The models run in the browser, so the farmer's phone needs no server to scan, read a slip or answer a question."),
  h2("Tech stack", "तंत्रज्ञान संच"),
  ledger(["Layer", "Choice", "Why"], [
    ["Application", "Next.js 16 (App Router), React 19, TypeScript", "One deployable for the pages, the API routes and the engine; reliable for a live demo"],
    ["Interface", "Tailwind CSS v4, Motion, shadcn/ui; Anek, Courier Prime and Kalam type", "The paper-register look; motion that respects reduced-motion settings"],
    ["Maps", "d3-geo survey sheet from OpenStreetMap; H3 resolution 7 cells; d3-contour on Copernicus DEM; canvas wind particles", "Cell-level privacy; real terrain; 460 wind particles at display rate"],
    ["Season engine", "TypeScript, deterministic hashed random draws", "192 plots × 245 days in about 150 ms; changing one plot never reshuffles another"],
    ["Spread forecast", "Advection kernel over 72 hourly frames; 51-member ensemble in the background", "About 5 ms a run; about 250 ms for the ensemble, six members a tick"],
    ["On-device vision", "ONNX Runtime Web (wasm) running MobileNetV2 in a module worker", "60–90 ms a leaf, no signal needed"],
    ["On-device OCR", "Tesseract.js 7 with English and Marathi LSTM models", "1.6–1.9 s English; 3.2–3.6 s with Marathi, loaded on demand"],
    ["Voice", "Web Speech API, mr-IN, in and out", "Marathi questions and spoken answers on the phone"],
    ["Sync and offline", "Server-sent events relay; IndexedDB outbox; hybrid logical clocks; service worker", "Works with no signal; no duplicates; newest change wins"],
    ["Open data", "Open-Meteo archive, forecast, ensemble, elevation; OpenStreetMap; Agmarknet with a key", "No keys needed to run the demo"],
    ["Tests", "puppeteer-core smoke (21 checks in Chrome), slip tests, backtest, tsc, ESLint, production build", "Every demo path proven end to end"],
  ], [1700, 4100, W - 5800], { boldFirst: true, size: 16 }),
  P("", { after: 80 }),
  h2("Bacterial blight in the season engine", "तेल्या रोग"),
  P("Each plot moves through the states below, one day at a time, on the recorded weather. The **Pest Radar** is built only from reported scans, never from the hidden state, exactly as a real desk would see it."),
  columns([
    [[...bullets([
      "**Favourability** each day: the wet-canopy hours over 12 (rain, or humidity at or above 85% at 18 to 35 °C), halved outside 25 to 37 °C, and 1.5 times on rainy days for splash.",
      "**Infection hazard** from symptomatic neighbours within 6 km, falling with distance and stronger downwind; a preventive spray cuts it to 35% for 10 days.",
    ])], 0],
    [[...bullets([
      "**Latent period** of 10 to 14 days before symptoms, then detection by the farmer's scan or an officer's visit.",
      "**Sprays** are booked on the first sprayable day (rain under 1 mm, rain chance under 45%, wind under 15 km/h); a spray on a day with 5 mm of rain is washed off and repeated.",
    ])], 0],
  ]),
  ...figure("d-blight.png", WPX - 10, "Each plot's blight states in the season engine."),
  h2("The 72-hour spread forecast", "७२ तासांचा अंदाज"),
  P("For each reported cell and each of the next 72 hours, the model asks where wind-driven rain could carry the bacterium. Hourly favourability is high in rain splash, lower on a wet canopy or in humid air, and zero when dry. The kernel stretches downwind with the wind speed and widens with distance:"),
  code([
    "K(x, y) = exp(-x / R) · exp(-y² / 2σ(x)²)        downwind, x > 0",
    "K(x, y) = 0.35 · exp(-|d| / 0.7)                  upwind",
    "R = 0.8 + 0.12·U km      σ(x) = 0.35 + 0.25·x km      U = wind speed, km/h",
    "",
    "Exposure E(cell) = Σ hours Σ sources  w(level) · φ(hour) · K        w = 0.5, 1.2, 2",
    "Tiers: low ≥ 0.35   moderate ≥ 1.2   high ≥ 4",
  ]),
  P("", { after: 60 }),
  ...bullets([
    "**Leaf wetness after rain** holds the wet-canopy term for 4 to 10 hours, longer after heavy rain, and two hours more in the **28 low-lying cells**, 12 m or more below their neighbours on the Copernicus DEM, where dew and cold air pool.",
    "**Uncertainty**: the model runs once per ECMWF ensemble member; the desk shows the share of the 51 members in which each cell reaches moderate exposure.",
    "**Storm brush**: a drawn track becomes a moving rain cell (8 mm an hour at the core, 4 km radius) with a gust front of at least 22 km/h.",
  ]),
  h3("Does it work? The backtest"),
  P(`\`npm run backtest\` forecasts every cell with no blight reported, every day from 11 July to 25 September on the recorded weather, and asks whether blight is reported there 8 to 24 days later, allowing for the latent period. Over ${bt.pairs.toLocaleString("en-IN")} cell-days with ${bt.positives} new reports:`),
  ...figure("c-backtest.png", WPX - 10, `Forecast skill as ROC AUC (0.5 is chance). The spread forecast scores ${bt.auc.forecast.toFixed(3)} against ${bt.auc.distanceOnly.toFixed(3)} for distance alone; an oracle that sees every symptomatic orchard scores ${bt.auc.oracleAllSymptomatic.toFixed(3)}.`),
  P(`The forecast's warn cells report blight later at ${(bt.warnCells.precision * 100).toFixed(1)}% against a ${(bt.warnCells.baseRate * 100).toFixed(1)}% base rate (${(bt.warnCells.precision / bt.warnCells.baseRate).toFixed(2)} times) and catch ${(bt.warnCells.recall * 100).toFixed(1)}% of new outbreaks; in September, the month with most reports, its AUC is ${bt.byMonth[2].forecast.toFixed(3)} against ${bt.byMonth[2].distanceOnly.toFixed(3)}. The oracle shows where the rest of the skill lies: **in reports**, which is why the phone matters. The reports here are the simulation's own, so this tests the method and the harness; the pilot runs the same harness on real scans and fits the reach, width and weights.`),
  h3("Calibration: the same engine on recorded and synthetic weather"),
  ...figure("c-calibration.png", WPX - 10, "With the same seed and 192 plots, the drier recorded season (mean humidity 73–77% against 79–82%) slows the spread: 65 plots infected by 20 October instead of 91."),
  h2("Scan Lens, water, harvest and runs", "इतर मॉडेल"),
  ledger(["Model", "How it works", "Honest limits"], [
    ["Scan Lens", "MobileNetV2 trained on PlantVillage (38 classes), crop-conditioned; a 7 × 7 occlusion map shows where it looked; a photo check (Laplacian sharpness, brightness) runs first", "95.4% on lab photos per its model card; misread two of three public field photos; pomegranate has no class, so its result is scripted until we train on Phaltan photos"],
    ["Water Commons", "Every three days, ET0 over three days × crop coefficient (0.3 to 0.9) × area × 0.55; skipped after 10 mm of rain or before 5 mm forecast, and counted as kept in the ground", "Not yet checked against flow meters"],
    ["Harvest Wave and prices", "Four pickings from harvest start, sharing 20, 35, 30 and 15% of the crop; grade from infection; prices from arrivals, with a Pune glut", "Prices simulated without an Agmarknet key"],
    ["Pooled runs", "Bookings grouped by day, collection point and market, packed largest-first into 75-crate vehicles along the real road graph", "A heuristic; OR-Tools routing is planned"],
  ], [1700, 4500, W - 6200], { boldFirst: true, size: 16 }),
  P("", { after: 80 }),
  h2("Reading a sale slip", "पट्टी वाचन"),
  columns([
    [[pipeline([
      ["Photograph the patti", "with the camera or from the gallery"],
      ["Read on the phone", "English first; Marathi too if needed"],
      ["Normalise", "Devanagari digits, separators, joiners"],
      ["Parse the fields", "crates, weight, rate, gross, charges, net"],
      ["Correct what proves itself", "leave unreadable numbers blank"],
      ["Check", "arithmetic, the rate card, the modal price"],
      ["The farmer decides", "file the sale, or send a dispute to the officer"],
    ], 3500, { color: STAMP })], 3700],
    [[
      P("Tesseract reads the photo in English first; if fewer than four key fields come out, it reads again with the Marathi and English models together. Devanagari digits become ASCII and labels are matched in both languages (अडत, हमाली, तोलाई, मोटार भाडे)."),
      P("**A number is corrected only when its own line proves it**: a multiplication on the label (\"हमाली 63 x 5\" must be 315), a percentage of the gross, or weight × rate, and only when it was read weakly and is one digit away. **Totals and the net are never corrected**, because that is where a real overcharge would hide. Unreadable numbers are left blank for the farmer, and every correction is underlined in violet."),
      P("Checks: weight against crates, gross against weight × rate, each charge against the FPO's rate card, the deductions against the total, and the rate against the day's modal price.", { after: 0 }),
    ], 0],
  ], { valign: VerticalAlign.CENTER }),
  P("", { after: 60 }),
  ...figure("c-slip.png", WPX - 10, "The specimen slip with extra charges, read on the phone: commission at 8% instead of the card's 6%, hamali at ₹7 a crate instead of ₹5, and a miscellaneous charge not on the card, ₹1,863 in all."),
  h2("Performance", "कामगिरी"),
  ledger(["Operation (laptop, Chrome)", "Time"], [
    ["Season engine: 192 plots, 245 days, recorded weather", "~150 ms"],
    ["Spread forecast: 72 frames, up to 48 source cells", "~5 ms"],
    ["Ensemble: 51 member runs, six per tick", "~250 ms, in the background"],
    ["Scan Lens: MobileNetV2 fp32, one leaf", "60–90 ms, plus the occlusion map"],
    ["Slip OCR: English, one 1,800 px photo", "1.6–1.9 s"],
    ["Slip OCR: Marathi and English, after an English pass", "3.2–3.6 s in all"],
  ], [W - 3200, 3200], { mono: [1], size: 16 }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 08 ARCHITECTURE
// ═════════════════════════════════════════════════════════════════════════════
const architecture = [
  ...section("System architecture", "प्रणाली रचना", "Open data in, the same engine in every browser, and a thin server that proxies the data and relays events between devices."),
  ...figure("d-architecture.png", WPX - 30, "The prototype's architecture. The server never holds a farmer's photo or slip; it relays overrides, questions and filed slips between the phone and the desk."),
  ledger(["Route", "What it serves"], [
    ["`/api/weather`", "The season recorded at Phaltan to yesterday, plus the seven-day forecast (Open-Meteo archive and forecast)"],
    ["`/api/weather/wind`", "Hourly wind at nine points over the taluka, for the wind field and the spread forecast"],
    ["`/api/weather/ensemble`", "All 51 ECMWF IFS members at Phaltan, hourly for four days"],
    ["`/api/prices`", "Agmarknet modal prices through data.gov.in when a key is set; a seeded fallback otherwise"],
    ["`/api/sync`", "The relay: server-sent events to every device, idempotent by clock stamp, newest overrides win"],
  ], [2400, W - 2400], { size: 15 }),
  P("", { after: 60 }),
  P("**Why the server is thin.** Everything a farmer does is decided on her phone. The server proxies open data, so that the data.gov.in key never reaches a phone, and relays events between devices. That keeps hosting small for the pilot, lets a phone work for days without signal, and means a lost connection never loses a scan."),
  h2("Offline-first sync", "ऑफलाइन समक्रमण"),
  ...figure("d-ripple.png", WPX - 20, "A scan made with no signal: held in the outbox, sent in clock order when signal returns, and replayed on the desk."),
  columns([
    [[
      ...bullets([
        "**Hybrid logical clock.** Every durable message is stamped with physical time, a counter and the device, written so that string order is causal order.",
        "**Outbox.** Messages wait in IndexedDB until the relay accepts them; a newer set of overrides replaces a queued one.",
      ], { after: 60 }),
    ], 0],
    [[
      ...bullets([
        "**Idempotent relay.** The relay ignores stamps it has seen, so a retry never duplicates a scan.",
        "**Last writer wins, by clock.** A phone that reconnects with older changes cannot overwrite newer ones; the header shows Synced, Sending or Offline · N to send.",
      ], { after: 60 }),
    ], 0],
  ]),
  h2("Data model and privacy", "माहिती आणि गोपनीयता"),
  columns([
    [[
      P("**The record is a list of events.** A scan, a spray, an irrigation, a picking, a sale, an advisory or a correction is an event with a day, an hour, a kind and who wrote it (computed, a person, or verified). Corrections are new events that point at the old one, so the record keeps its history and its inks. Every view derives its state for a chosen day, which is what lets every screen replay the season."),
      P("**Privacy by construction.** Shared maps aggregate to H3 cells of about 5 km² [[h3]], never a farm; photos and slips are read on the phone and only findings are filed; in the pilot, every share is a purpose-bound, revocable consent under the Digital Personal Data Protection Act, 2023 [[dpdp]].", { after: 0 }),
    ], 0],
    [[
      slip("safety rules in the code", [
        P([run("→ ", { color: ALERT, bold: true }), ...md("Doses only from the rules table, which follows ICAR-NRCP advice [[advisory]]; the antibiotic Streptocycline has been removed [[strep,bacillus]].", { size: 16 })], { after: 50 }),
        P([run("→ ", { color: ALERT, bold: true }), ...md("Language never invents a dose or a fact: answers are built by code from the record.", { size: 16 })], { after: 50 }),
        P([run("→ ", { color: ALERT, bold: true }), ...md("A copper spray within 60 days of a picking fails the export check [[apeda]].", { size: 16 })], { after: 0 }),
      ], { width: 4300 }),
    ], 4300],
  ]),
  P("", { after: 60 }),
  h2("Target architecture for the pilot", "पायलटसाठी रचना"),
  P("For the pilot the record moves to the server as an append-only table of events, so that a lost phone loses nothing and every share is checked against consent:", { keepNext: true }),
  code([
    "create table plot_events (",
    "  id uuid primary key,              -- UUIDv7, made on the phone",
    "  plot_id text not null references plots(id),",
    "  occurred_on date not null,  hour real,",
    "  kind text not null,               -- scan, spray, irrigate, pick, sale, advisory, correction",
    "  by text not null check (by in ('computed','human','verified')),",
    "  payload jsonb not null,  device_id text not null,",
    "  hlc text not null,                -- hybrid logical clock, orders events across devices",
    "  consent text[] not null,          -- scopes this event may be shared under",
    "  recorded_at timestamptz not null default now());",
  ], { size: 14 }),
  P("", { after: 80 }),
  ...figure("d-target.png", WPX - 90, "For the pilot: an append-only event store in Postgres with PostGIS and H3, projections for each collective layer, fitted models fed by scheduled jobs, and feature phones reached by IVR and SMS."),
];

// ═════════════════════════════════════════════════════════════════════════════
// 09 BUSINESS
// ═════════════════════════════════════════════════════════════════════════════
const business = [
  ...section("Business model", "व्यवसाय प्रारूप", "Free for the farmer. Paid for by those who gain from many records together: the FPO, the extension system and buyers who need traceable lots."),
  ...figure("d-business.png", WPX - 10, "Who gives what and who pays. The farmer's app is free and her record is hers; value flows to the FPO, the officer and buyers only in aggregate or with her consent."),
  ledger(["Customer", "What they get", "How they could pay (to test)", "Why they would"], [
    ["Farmer", "The app, her record, advice, scans, slip checks, lot passports", "Free", "Adoption is the network: every record makes the radar and the wave better"],
    ["FPO", "The desk, rate cards, pooled runs, the fair-slip index", "A fee per member per season, and a small fee per pooled crate", "Fuller trucks, fewer disputes, a stronger hand with agents"],
    ["Agriculture department, ATMA, KVK", "Pest Radar, spread forecast, inbox, field priorities", "Programme funding or a licence per taluka", "Early warning and reach at one officer per 5,000 farmers [[jaem]]"],
    ["Buyers and exporters", "Lot passports with spray history and the pre-harvest check", "A traceability fee per lot", "Residue compliance and export registration made easier"],
    ["Researchers", "Aggregated, delayed, k-anonymous cell-level data", "Data access grants", "Disease and harvest data at village resolution"],
  ], [1700, 2900, 2500, W - 7100], { boldFirst: true, size: 16 }),
  P("", { after: 80 }),
  columns([
    [[
      h3("Why costs stay low"),
      ...bullets([
        "**No inference servers.** Scans, OCR and voice run on the farmer's phone.",
        "**Open data.** Weather, ensemble, terrain and maps need no paid keys.",
        "**One deployable.** Pages, API and engine in one app; Postgres for the pilot.",
        "**Costs that grow with use:** SMS and WhatsApp messages, hosting, and field staff time, which is why the FPO and programme funding carry them.",
      ]),
    ], 0],
    [[
      h3("How it grows"),
      ...steps([
        "**One FPO, three villages**: prove that farmers keep the record and that the desk earns a weekly look.",
        "**The taluka**, with the agriculture department: the radar and the wave across 130 villages.",
        "**Other pomegranate talukas** of Solapur, Sangli and Ahmednagar, which share the crop, the disease and the markets.",
        "**More crops** in the same talukas: the record, radar and wave are crop-agnostic; the models are not.",
      ]),
    ], 0],
  ]),
  slip("what protects it", ["**The records themselves.** A radar improves with every report and a harvest wave with every plot, so the second FPO gains from the first. The pomegranate model trained on consented Phaltan photos, the FPO's rate cards and the trust of being the FPO's data steward are hard to copy; the code is not the moat."], { accent: STAMP }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 10 FEASIBILITY
// ═════════════════════════════════════════════════════════════════════════════
const feasibility = [
  ...section("Feasibility", "व्यवहार्यता", "Most of what the pilot needs already runs. What remains is field data, an agronomist's review and accounts with consent."),
  ledger(["Dimension", "Evidence today", "What remains"], [
    ["Technical", "Phone and desk built; on-device scan, OCR and voice; offline outbox; ensemble forecast; 21 of 21 end-to-end checks and 3 of 3 slip tests pass", "Server-side event store, accounts, SMS; a trained pomegranate model"],
    ["Data", "Recorded and live weather, wind, ensemble, elevation and map, all open; Agmarknet with a key", "Real reports, real pattis, the FPO's rate cards"],
    ["Devices", "Runs in the browser; each model under 10 MB (leaf model 9.2 MB, OCR 3.0 and 2.0 MB); Marathi OCR loads only on demand; precached for offline", "Testing on 2 GB RAM Android phones"],
    ["People", "The desk follows an officer's day: register, inbox, warnings; the phone is Marathi-first and voice-first", "A pilot FPO and an officer who use it weekly"],
    ["Regulation", "Doses from ICAR-NRCP advice; the antibiotic removed; the APEDA pre-harvest interval checked; consent planned under the DPDP Act", "An agronomist's sign-off; the final status of the antibiotic ban [[strep]]"],
    ["Cost", "No inference servers or paid data keys", "SMS, WhatsApp and hosting accounts"],
  ], [1500, 4700, W - 6200], { boldFirst: true, size: 16 }),
  P("", { after: 80 }),
  h2("Risks and mitigations", "धोके"),
  ledger(["Risk", "Mitigation"], [
    ["Too few scans make the radar blind", "Officer visits recorded as verified scans; the neighbour pulse rewards reporting; SMS reporting for no-data areas"],
    ["A wrong diagnosis leads to a wrong spray", "A confidence floor; officer confirmation for curative advice; doses only from the reviewed table"],
    ["Spray advice falls out of date or breaks a rule", "The table is owned by a named agronomist and reviewed each season against current approvals"],
    ["Agents push back on slip checks", "Compare only with the FPO's own agreed card; publish an aggregate index; the farmer decides whether to dispute"],
    ["No signal in the orchard; low-end phones", "Offline-first with an outbox, SMS for urgent events, IVR; models under 10 MB"],
    ["Privacy and trust", "Consent per purpose, cell-level maps, photos on the device, the FPO as data steward"],
    ["The leaf model's licence", "Train our own pomegranate model on consented photos and publish its card"],
  ], [3300, W - 3300], { boldFirst: true, size: 16 }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 11 IMPACT
// ═════════════════════════════════════════════════════════════════════════════
const impact = [
  ...section("Impact", "प्रभाव", "Less crop lost to blight, more of the price kept, and an aquifer the village protects together. Here is how each would come about, what the demo season shows, and how the pilot will measure it."),
  columns([
    [[pipeline([
      ["Inputs", "open weather, map and elevation data; farmers' phones; FPO and officer time"],
      ["Activities", "keep the record; scan, ask, check slips; forecast and advise; plan pickings and runs"],
      ["Outputs", "scans reported; advisories delivered; runs filled; slips checked"],
      ["Outcomes", "sprays that stick; earlier warning downwind; water left in the ground; fair deductions, fuller trucks"],
      ["Impact", "less crop lost to blight; higher net income; a protected aquifer"],
    ], 3900, { color: ALERT })], 4100],
    [[
      h3("Who gains what"),
      ...bullets([
        "**The farmer**: sprays that stick, an earlier warning when blight is upwind, irrigation skipped before rain, a picking moved off the glut week, a full truck, and rupees back on a wrong slip.",
        "**The officer**: reports as they arrive, a forecast of where to warn, and questions sorted so that only the hard ones reach the inbox.",
        "**The FPO**: lots and pickings known days ahead, fuller runs, and an index of slips above the card for its negotiations.",
        "**The village**: groundwater kept in a semi-critical block, and fewer infections spreading to the next orchard.",
        "**Buyers**: lots with a traceable spray and water history, checked against the export pre-harvest interval.",
      ]),
    ], 0],
  ], { valign: VerticalAlign.CENTER }),
  P("", { after: 80 }),
  h2("What the demo season shows", "डेमो हंगाम"),
  P("The simulated network of 192 plots on the recorded 2026 weather. These are **outputs of the simulation, not field results**; they show what the pilot will measure.", { keepNext: true }),
  tiles([
    { value: `${stats.waterKeptMl}`, unit: "ML", label: `kept in the ground by skipping irrigation before forecast rain; ${stats.forecastIrrigationShare}% of plots follow the forecast`, tag: "simulated", tagColor: INK2, color: WATER },
    { value: "62 → 52", label: "plots warned downwind on 19 September, and preventive sprays booked; new infections 14 → 11", tag: "simulated", tagColor: INK2, color: STAMP },
    { value: stats.runs.toLocaleString("en-IN"), label: `pooled runs at ${stats.meanFillPct}% average fill, moving ${stats.cratesMoved.toLocaleString("en-IN")} crates`, tag: "simulated", tagColor: INK2 },
    { value: `${stats.deductionsPct}%`, label: `average deductions on ${stats.sales} sale slips, checked against the card`, tag: "simulated", tagColor: INK2, color: ROSE },
  ], { big: 40 }),
  P("", { after: 100 }),
  h2("How we will know it works", "मोजमाप"),
  ledger(["Question", "Measure", "Pilot target (hypothesis)", "How measured"], [
    ["Do farmers keep the record?", "Weekly active farmers", "60% of enrolled", "Event log"],
    ["Does the radar see enough?", "Plots with a scan in the last 14 days, in the monsoon", "50%", "Event log"],
    ["Are sprays wasted less?", "Sprays followed by 5 mm of rain within 6 hours", "Half the pre-pilot baseline", "Records against recorded weather; baseline survey"],
    ["Does the forecast warn the right plots?", "ROC AUC of 72-hour exposure for later detections", "Above the distance-only baseline", "Pilot detections, same harness"],
    ["Do advisories arrive in time?", "Plots in the plume reached within 2 hours", "80%", "Delivery receipts"],
    ["Is water kept?", "Litres skipped before rain on metered plots", "Within 20% of the model", "Flow meters"],
    ["Are slips fair?", "Slips flagged; rupees recovered after a dispute", "Measured, not targeted", "Slip checks, follow-up"],
    ["Do runs fill?", "Average fill of pooled runs", "80%", "Run records"],
  ], [2400, 2900, 2000, W - 7300], { boldFirst: true, size: 16 }),
];

// ═════════════════════════════════════════════════════════════════════════════
// 12 IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════
const implementation = [
  ...section("Implementation plan", "अंमलबजावणी", "From a demo on real weather to a record that real farmers keep: one FPO and three villages through the Ambia bahar of 2027, then the taluka through the Mrig bahar."),
  ...figure("d-gantt.png", WPX - 10, "The roadmap. The two critical bars are the seasons that produce field data: the Ambia bahar pilot of 2027 and the Mrig bahar at taluka scale."),
  ledger(["Horizon", "When", "What gets built", "Done when"], [
    ["H0 · Demo", "to 2 Nov 2026", "Spray table review; rehearsal on a real Android phone; a backup video", "A named reviewer signs off the table; the demo runs twice without a reset"],
    ["H1 · Pilot", "Nov 2026 – Jun 2027", "Accounts and consent; the event store; SMS fallback; a pomegranate photo campaign and Scan Lens v2 on the NPU; Marathi voice v2 with WhatsApp and IVR; real pattis and FPO rate cards; spread forecast v2, fitted", "A farmer can reinstall and see her season; blight recall on a held-out village published; the forecast beats distance alone on pilot detections, or we say plainly that it does not"],
    ["H2 · Taluka", "Apr 2027 – Jan 2028", "Sentinel-2 plot health; Water Commons v2 with wells and flow meters; harvest and price forecasts; OR-Tools pooled runs and a driver app; an export record ready for AnarNet", "The Mrig bahar of 2027 runs across the taluka"],
    ["H3 · Platform", "2028 onward", "Other pomegranate talukas; more crops; links to AgriStack and ONDC with consent; open aggregated data; federated learning for Scan Lens", "A second district runs on the same record"],
  ], [1400, 1500, 4000, W - 6900], { boldFirst: true, size: 16 }),
  P("", { after: 80 }),
  h2("The pilot, step by step", "पायलट"),
  columns([
    [[
      ...steps([
        "**Choose the FPO and three villages** along one blight corridor, with the officer who covers them.",
        "**Enrol about 150 farmers** at village meetings: a phone account, the plot by gat number and a GPS walk, consent per purpose, explained in Marathi.",
        "**Baseline survey** of sprays, irrigation, pickings and slips from the last season, to measure against.",
        "**Photo days** with KVK staff in blight weather; a plant pathologist labels the photos; train and test on a village never seen.",
      ], { after: 60 }),
    ], 0],
    [[
      ...steps([
        "**Weekly desk review** with the officer and the FPO: the radar, the inbox, the wave and the runs.",
        "**Collect real pattis** after pickings (names blurred) to tune the reader to each agent's layout; record the rate card.",
        "**Score every model** on field data with the same harnesses: the forecast backtest, per-class recall for Scan Lens, slip accuracy.",
        "**Publish the results**, including what did not work, before the Mrig bahar.",
      ], { after: 60, continue: true }),
    ], 0],
  ]),
  h2("Team and resources", "आवश्यक संसाधने"),
  ledger(["Need", "Who or what", "For"], [
    ["Agronomy", "A plant pathologist (ICAR-NRCP Solapur, MPKV Rahuri or KVK staff, to be approached)", "Reviewing the spray table; labelling photos"],
    ["A pilot FPO", "One FPO in Phaltan taluka", "Rate cards; running the desk weekly"],
    ["Field time", "Photo days in blight season; slip collection after pickings", "Training and testing the models"],
    ["Devices", "Three low-end Android phones; flow meters on a sample of plots", "Device testing; checking the water model"],
    ["Services", "A data.gov.in key; an SMS gateway; WhatsApp Business; hosting for Postgres and the realtime channel", "Live prices, alerts and the event store"],
  ], [1500, 4800, W - 6300], { boldFirst: true, size: 16 }),
];

// ═════════════════════════════════════════════════════════════════════════════
// APPENDIX
// ═════════════════════════════════════════════════════════════════════════════
const GLOSSARY = [
  ["Adat, adatya", "Commission; the commission agent who auctions a lot at the APMC and pays the farmer after deductions"],
  ["APMC", "Agricultural Produce Market Committee: the regulated market yard (Phaltan, Pune, Vashi)"],
  ["Bahar", "Forced flowering by withholding water and pruning: Ambia (Jan–Feb), Mrig (Jun–Jul), Hasta (Sep–Oct)"],
  ["ET0, Kc", "Reference evapotranspiration from the weather, times a crop coefficient for the stage"],
  ["FPO", "Farmer producer organisation: a farmers' company that pools produce and negotiates"],
  ["Gat number", "The land-record survey number that identifies a plot in the village"],
  ["H3", "A global grid of hexagons; resolution 7 cells average about 5 km², so shared maps never show a farm"],
  ["Hamali, tolai", "Loading charge and weighment charge, per crate"],
  ["Kundli", "A birth chart; here, the plot's season record that keeps updating"],
  ["KVK", "Krishi Vigyan Kendra: the district farm science centre"],
  ["Leaf-wet hours", "Hours with a wet canopy (rain, or humidity at or above 85%) at 18 to 35 °C"],
  ["Patti", "The sale slip from the agent: lot, weight, rate, gross, deductions, net"],
  ["PHI", "Pre-harvest interval: the minimum days between a spray and picking"],
  ["Pooled run", "One vehicle carrying several farmers' crates from a collection point to market"],
  ["Rate card", "The deductions the FPO agreed with an agent: commission, hamali, weighment, freight"],
  ["Telya", "Bacterial blight of pomegranate, Xanthomonas axonopodis pv. punicae"],
];

const half = Math.ceil(GLOSSARY.length / 2);
const glossCell = (g, w) => cell(g ? [P([run(g[0], { font: HEAD2, size: 16 })], { after: 10, line: 240 }), P(g[1], { size: 15, color: INK2, after: 0, line: 240 })] : P(""), w, { fill: WHITE, mt: 50, mb: 50 });
const gw = Math.floor(W / 2);

const appendix = [
  ...section("Appendix", "परिशिष्ट"),
  h2("A. Glossary", "शब्दसूची"),
  table(Array.from({ length: half }, (_, i) => new TableRow({ cantSplit: true, children: [glossCell(GLOSSARY[i], gw), glossCell(GLOSSARY[i + half], W - gw)] })), [gw, W - gw], { borders: { top: line(INK, 8), bottom: line(INK, 8), left: NONE, right: NONE, insideHorizontal: line(), insideVertical: line() } }),
  P("", { after: 80 }),
  h2("B. Sources", "संदर्भ"),
  P("Accessed in October 2026. Where a source is marked *via search index*, we read the text the search engine returned rather than the original document, and it should be checked against the original before it is quoted elsewhere.", { size: 16, color: INK2 }),
  ...SOURCES.map(([, text, url, note], i) => P([
    run(`${String(i + 1).padStart(2, " ")}  `, { font: MONO, bold: true, size: 15, color: STAMP }),
    ...md(text, { size: 15 }),
    ...(url ? [run(" "), new ExternalHyperlink({ link: url, children: [run(url, { font: MONO, size: 13, color: WATER })] })] : []),
    ...(note ? [run(` (${note})`, { size: 14, color: INK3, italics: true })] : []),
  ], { after: 50, line: 240, indent: { left: 360, hanging: 360 } })),
  P("", { after: 60 }),
  h2("C. Live, recorded and simulated", "खरे आणि नमुना"),
  ledger(["What the prototype shows", "Status on screen"], [
    ["Phaltan weather, 1 June to yesterday, hourly, with leaf-wet hours", "**Recorded**: Open-Meteo archive"],
    ["Next seven days of weather; the 72-hour hourly forecast; the nine-point wind grid; the 51-member ensemble", "**Live**: Open-Meteo forecast and ensemble"],
    ["Taluka boundary, villages, roads, rivers, canals, rail", "**Real**: OpenStreetMap"],
    ["Contour lines on the survey sheet; the 28 low-lying cells", "**Real**: Copernicus DEM via Open-Meteo"],
    ["Leaf scans; sale-slip reading in English and Marathi", "**Live** inference on the device"],
    ["192 farmers, plots, sprays, scans, pickings, sales; mandi prices without a key; the three specimen slips", "**Simulated**, labelled synthetic"],
  ], [W - 3400, 3400], { size: 15 }),
  P("", { after: 80 }),
  h2("D. The documents behind this report", "दस्तऐवज"),
  ledger(["Document", "What it covers"], [
    ["`docs/PROBLEM.md`", "Phaltan, pomegranate and the problems; the six problem statements and how one record answers them"],
    ["`docs/ARCHITECTURE.md`", "System design, data model, the sync protocol, offline, performance and tests"],
    ["`docs/MODELS.md`", "Blight, the spread forecast and its backtest, water, harvest, markets, runs, Scan Lens, the slip check, voice"],
    ["`docs/DATA.md`", "Every data source and schema; live, recorded and simulated; privacy"],
    ["`docs/AGRONOMY.md`", "The spray table and its sources; why the antibiotic was removed; what still needs an agronomist"],
    ["`docs/ROADMAP.md`", "From the demo to a pilot to the taluka: features, designs, data, metrics, risks"],
    ["`docs/EXPERIENCE.md`, `DESIGN.md`", "The Living Record design world, surfaces, motion, Marathi, accessibility"],
  ], [3000, W - 3000], { size: 15 }),
  P("", { after: 80 }),
  h2("E. Running and checking the prototype", "चालवणे"),
  columns([
    [[code([
      "cd web",
      "npm install",
      "npm run dev          # /, /farmer, /desk",
      "npm run smoke        # 21 checks in Chrome",
      "npm run test:slips   # 3 specimen slips",
      "npm run backtest     # forecast skill",
      "npm run build && npm start",
    ], { width: 4500, size: 14 })], 4500],
    [[
      P("The source, the documents behind this report (problem, architecture, models, data, roadmap, agronomy) and the scripts that drew its figures are in the repository [[repo]]. The figures are regenerated from the season data by `scripts/report/figures.mjs`, and this document by `scripts/report/make-report.mjs`."),
      P("Built by **Team Outliers** for the Phaltan Hackathon, agriculture track.", { after: 0 }),
    ], 0],
  ], { valign: VerticalAlign.CENTER }),
  P("", { after: 160 }),
  table([new TableRow({ cantSplit: true, children: [cell([
    P([run("Every plot remembers. Every village sees together.", { font: HEAD, size: 44, color: BOARD_INK })], { align: AlignmentType.CENTER, after: 40, line: 240 }),
    P([run("प्रत्येक शेत लक्षात ठेवते. संपूर्ण गाव एकत्र पाहते.", { font: DEV, size: 24, color: BOARD_INK })], { align: AlignmentType.CENTER, after: 60, line: 240 }),
    P([run("KHETKUNDLI · TEAM OUTLIERS · PHALTAN HACKATHON 2026", { font: MONO, size: 15, color: BOARD_INK2, bold: true })], { align: AlignmentType.CENTER, after: 0, line: 240 }),
  ], W, { fill: "CDA868", mt: 240, mb: 240, ml: 200, mr: 200, borders: { top: line(BOARD_INK, 12), bottom: line(BOARD_INK, 12), left: line(BOARD_INK, 12), right: line(BOARD_INK, 12) } })] })], [W]),
  P("", { after: 0, line: 120, size: 4 }),
];

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT
// ═════════════════════════════════════════════════════════════════════════════
const pageProps = (o = {}) => ({
  page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: o.top ?? 1180, bottom: o.bottom ?? 1000, left: MARGIN, right: MARGIN, header: 500, footer: 440 } },
});

const doc = new Document({
  creator: "Team Outliers",
  title: "KhetKundli: project report",
  description: "Problem, scale, gaps, approach, solution, technology, architecture, business model, feasibility, impact and implementation plan.",
  styles: {
    default: {
      document: { run: { font: fontOf(SANS), size: BODY, color: INK }, paragraph: { spacing: { after: 110, line: 264 } } },
      heading1: { run: { font: fontOf(HEAD), size: 50, color: INK, bold: false }, paragraph: { spacing: { before: 0, after: 140, line: 240 }, keepNext: true } },
      heading2: { run: { font: fontOf(HEAD2), size: 27, color: INK, bold: false }, paragraph: { spacing: { before: 200, after: 80, line: 240 }, keepNext: true } },
      heading3: { run: { font: fontOf(HEAD2), size: 19, color: STAMP, bold: false, allCaps: true, characterSpacing: 10 }, paragraph: { spacing: { before: 140, after: 60, line: 240 }, keepNext: true } },
    },
    paragraphStyles: [
      { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal", run: { font: fontOf(HEAD2), size: 22, color: INK }, paragraph: { spacing: { before: 60, after: 60 }, indent: { left: 0 } } },
    ],
  },
  numbering: {
    config: [
      { reference: "dot", levels: [{ level: 0, format: LevelFormat.BULLET, text: "▪", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 300, hanging: 220 } }, run: { color: STAMP } } }] },
      { reference: "arrow", levels: [{ level: 0, format: LevelFormat.BULLET, text: "→", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 340, hanging: 260 } }, run: { color: ALERT, bold: true } } }] },
      { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 340, hanging: 300 } }, run: { color: STAMP, bold: true, font: fontOf(MONO) } } }] },
    ],
  },
  sections: [
    { properties: pageProps({ top: 900, bottom: 700 }), headers: { default: coverHeader }, footers: { default: new Footer({ children: [new Paragraph("")] }) }, children: cover },
    {
      properties: pageProps(),
      headers: { default: bodyHeader },
      footers: { default: bodyFooter },
      children: [
        ...contents,
        ...summary, ...problem, ...scale, ...gaps, ...approach, ...solution, ...technology,
        ...architecture, ...business, ...feasibility, ...impact, ...implementation, ...appendix,
      ],
    },
  ],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log(`wrote ${path.relative(ROOT, OUT)} · ${(buf.length / 1e6).toFixed(1)} MB · ${figNo} figures · ${sectionNo} sections`);
