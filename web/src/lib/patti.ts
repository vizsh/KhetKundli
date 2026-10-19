import { geo, routeByHub } from "@/lib/geo";
import { mrNum } from "@/lib/farmer";
import { dayOf, SEASON_DAYS } from "@/lib/sim/calendar";
import { COMMISSION, CRATE_KG, HAMALI_PER_CRATE, markets, WEIGHMENT_PER_CRATE } from "@/lib/sim/rules";
import type { MarketId, SaleSlip, Season } from "@/lib/sim/types";

export type { SaleSlip };

/**
 * Sale slip (patti) reading: OCR lines in, a structured slip out, then every number checked
 * against arithmetic and the rate card agreed for pooled-run lots. No model invents a number:
 * each value is either read from the photo or typed by the farmer.
 */

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type OcrWord = { text: string; confidence: number; bbox: Box };
export type OcrLine = { text: string; confidence: number; bbox: Box; words: OcrWord[] };

export type ChargeKind = "commission" | "hamali" | "weighment" | "freight" | "other";
export type Charge = { label: string; amount: number; kind: ChargeKind; percent?: number; conf: number; box?: Box };

export type SlipNumber = "crates" | "kg" | "rate" | "gross" | "total" | "net";
export type Slip = {
  agent?: string;
  market: MarketId;
  pattiNo?: string;
  date?: string;
  day?: number;
  farmer?: string;
  grade?: "A" | "B" | "C";
  crates?: number;
  kg?: number;
  rate?: number;
  gross?: number;
  total?: number;
  net?: number;
  charges: Charge[];
  /** OCR confidence (0–100) for each number read; absent when the farmer typed it. */
  conf: Partial<Record<SlipNumber, number>>;
  boxes: Partial<Record<SlipNumber, Box>>;
  /** Lines the reader did not use: headings in Marathi, notes, stray marks. */
  skipped: string[];
};

const AMOUNT = /(-?\d[\d,]*(?:\.\d{1,2})?)\s*$/;
const num = (s: string) => Number(s.replace(/,/g, ""));
const lastWordBox = (l: OcrLine) => l.words.at(-1)?.bbox ?? l.bbox;
const lastWordConf = (l: OcrLine) => l.words.at(-1)?.confidence ?? l.confidence;

function kindOf(label: string): ChargeKind | "gross" | "total" | "net" | null {
  const l = label.toLowerCase();
  if (/gross|sale amount|bill amount|total sale/.test(l)) return "gross";
  if (/total\s*(deduction|exp|charge|kharch)|deductions?\s*total|less\s*total/.test(l)) return "total";
  if (/\bnet\b|payable|to pay|balance/.test(l)) return "net";
  if (/commission|adat|adt\b|dalali|brokerage/.test(l)) return "commission";
  if (/hamali|hamal|loading|unloading/.test(l)) return "hamali";
  if (/\btolai\b|\btulai\b|weigh/.test(l)) return "weighment";
  if (/motor|freight|bhada|bhade|transport|vahan|gadi/.test(l)) return "freight";
  return null;
}

/** Turns OCR lines into a slip. Charges are the amount lines between the gross and the total. */
export function parseSlip(lines: OcrLine[]): Slip {
  const slip: Slip = { market: "phaltan", charges: [], conf: {}, boxes: {}, skipped: [] };
  const setNum = (k: SlipNumber, v: number, l: OcrLine, box?: Box, conf?: number) => {
    if (slip[k] !== undefined || !Number.isFinite(v)) return;
    slip[k] = v;
    slip.conf[k] = Math.round(conf ?? l.confidence);
    slip.boxes[k] = box ?? l.bbox;
  };
  let inCharges = false;
  for (const [i, l] of lines.entries()) {
    const text = l.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (i === 0 && /[A-Za-z]{3}/.test(text) && !/\d/.test(text)) slip.agent = text.replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase());
    if (/pune|gultekdi|market yard/i.test(text)) slip.market = "pune";
    else if (/vashi|navi mumbai/i.test(text)) slip.market = "vashi";

    let used = false;
    const patti = text.match(/patti\s*no\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]*)/i);
    if (patti) { slip.pattiNo ??= patti[1]; used = true; }
    const date = text.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (date && !slip.date) {
      const y = Number(date[3].length === 2 ? `20${date[3]}` : date[3]);
      const d = dayOf(y, Number(date[2]) - 1, Number(date[1]));
      slip.date = `${date[1].padStart(2, "0")}/${date[2].padStart(2, "0")}/${y}`;
      if (d >= 0 && d < SEASON_DAYS) slip.day = d;
      used = true;
    }
    const farmer = text.match(/farmer\s*(?:name)?\s*[:\-]\s*(.+)$/i);
    if (farmer) { slip.farmer ??= farmer[1].trim(); used = true; }
    const grade = text.match(/grade\s*[:\-]?\s*([ABC])\b/i);
    if (grade) { slip.grade ??= grade[1].toUpperCase() as Slip["grade"]; used = true; }
    const crates = text.match(/\bcrates?\s*[:\-]\s*(\d{1,4})\b/i) ?? text.match(/\b(\d{1,4})\s*crates?\b/i);
    if (crates) { setNum("crates", Number(crates[1]), l, l.words.find((w) => w.text.includes(crates[1]))?.bbox); used = true; }
    const kg = text.match(/weight\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*kg/i) ?? text.match(/(\d[\d,]*(?:\.\d+)?)\s*kg\b(?!\s*\/)/i);
    if (kg) { setNum("kg", num(kg[1]), l, l.words.find((w) => w.text.includes(kg[1]))?.bbox); used = true; }
    const rate = text.match(/rate\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)/i);
    if (rate) { setNum("rate", num(rate[1]), l, l.words.find((w) => w.text.includes(rate[1]))?.bbox); used = true; }

    const amount = text.match(AMOUNT);
    const label = amount ? text.slice(0, amount.index).trim() : "";
    const kind = amount && /[A-Za-z]{3}/.test(label) ? kindOf(label) : null;
    // Headings such as "Commission Agent, Shop 14" carry numbers too: charges count only after the gross.
    if (amount && kind && (kind === "gross" || kind === "total" || kind === "net" || inCharges)) {
      const v = num(amount[1]);
      if (kind === "gross") { setNum("gross", v, l, lastWordBox(l), lastWordConf(l)); inCharges = true; }
      else if (kind === "total") { setNum("total", v, l, lastWordBox(l), lastWordConf(l)); inCharges = false; }
      else if (kind === "net") { setNum("net", v, l, lastWordBox(l), lastWordConf(l)); inCharges = false; }
      else {
        const pct = label.match(/(\d+(?:\.\d+)?)\s*%/);
        slip.charges.push({ label, amount: v, kind, percent: pct ? Number(pct[1]) : undefined, conf: Math.round(lastWordConf(l)), box: lastWordBox(l) });
      }
      used = true;
    } else if (amount && inCharges && /[A-Za-z]{3}/.test(label)) {
      // An amount line between gross and total that is not on the rate card.
      slip.charges.push({ label, amount: num(amount[1]), kind: "other", conf: Math.round(lastWordConf(l)), box: lastWordBox(l) });
      used = true;
    }
    if (!used && !/^less\b/i.test(text) && i > 1) slip.skipped.push(text);
  }
  return slip;
}

export type RateCard = { commission: number; hamaliPerCrate: number; weighmentPerCrate: number; freightPerCrate: number; crateKg: number };

/** The deductions agreed for pooled-run lots, from the same rules the season engine uses. */
export function rateCardFor(season: Season, plot: number, market: MarketId): RateCard {
  const hub = geo.villages[season.plots[plot].village].hub;
  const mk = markets(routeByHub.get(hub)?.km ?? 15)[market];
  return { commission: COMMISSION, hamaliPerCrate: HAMALI_PER_CRATE, weighmentPerCrate: WEIGHMENT_PER_CRATE, freightPerCrate: mk.freightPerCrate, crateKg: CRATE_KG };
}

export type Check = {
  id: string;
  tone: "ok" | "flag" | "info";
  en: string;
  mr: string;
  /** Rupees the farmer may be owed because of this line. */
  extra?: number;
  /** The agreed amount, for charge lines. */
  card?: number;
  charge?: number;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const inrMr = (n: number) => `₹${mrNum(Math.round(n).toLocaleString("en-IN"))}`;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function checkSlip(slip: Slip, card: RateCard, modal?: number): Check[] {
  const out: Check[] = [];
  const { crates, kg, rate, gross } = slip;

  if (crates && kg) {
    const expected = crates * card.crateKg;
    if (kg < expected * 0.95) {
      out.push({ id: "kg", tone: "flag", en: `Billed weight ${kg.toLocaleString("en-IN")} kg is ${Math.round(expected - kg)} kg under ${crates} crates of about ${card.crateKg} kg. Ask how the weight was cut.`, mr: `बिलातील वजन ${mrNum(kg)} किलो, ${mrNum(crates)} क्रेटच्या अंदाजापेक्षा ${mrNum(Math.round(expected - kg))} किलो कमी. वजन कसे कापले ते विचारा.` });
    } else {
      out.push({ id: "kg", tone: "ok", en: `Weight ${kg.toLocaleString("en-IN")} kg fits ${crates} crates of about ${card.crateKg} kg.`, mr: `वजन ${mrNum(kg)} किलो, ${mrNum(crates)} क्रेटशी जुळते.` });
    }
  }

  if (kg && rate && gross !== undefined) {
    const expected = Math.round(kg * rate);
    if (Math.abs(expected - gross) > 1) {
      out.push({ id: "gross", tone: "flag", extra: Math.max(0, expected - gross), en: `${kg.toLocaleString("en-IN")} kg × ₹${rate} is ${inr(expected)}, but the slip says ${inr(gross)}.`, mr: `${mrNum(kg)} किलो × ₹${mrNum(rate)} = ${inrMr(expected)}, पण पावतीवर ${inrMr(gross)}.` });
    } else {
      out.push({ id: "gross", tone: "ok", en: `Gross adds up: ${kg.toLocaleString("en-IN")} kg × ₹${rate} = ${inr(gross)}.`, mr: `एकूण रक्कम बरोबर: ${inrMr(gross)}.` });
    }
  }

  if (rate && modal) {
    const gap = rate - modal;
    out.push({
      id: "rate",
      tone: "info",
      en: Math.abs(gap) <= Math.max(2, modal * 0.05) ? `Rate ₹${rate}/kg is in line with the day's modal for this grade, about ₹${Math.round(modal)}.` : `Rate ₹${rate}/kg is ₹${Math.abs(Math.round(gap))} ${gap < 0 ? "below" : "above"} the day's modal for this grade, about ₹${Math.round(modal)}.`,
      mr: `भाव ₹${mrNum(rate)}/किलो; त्या दिवशीचा सरासरी भाव सुमारे ₹${mrNum(Math.round(modal))}.`,
    });
  }

  slip.charges.forEach((c, i) => {
    const base = { id: `c${i}`, charge: i };
    if (c.kind === "other") {
      out.push({ ...base, tone: "flag", extra: c.amount, card: 0, en: `“${c.label}” ${inr(c.amount)} is not on the agreed rate card. Ask what it is for.`, mr: `“${c.label}” ${inrMr(c.amount)} ठरलेल्या दरपत्रकात नाही. हे कशासाठी ते विचारा.` });
      return;
    }
    const agreed =
      c.kind === "commission" ? (gross ? Math.round(gross * card.commission) : undefined)
      : crates ? crates * (c.kind === "hamali" ? card.hamaliPerCrate : c.kind === "weighment" ? card.weighmentPerCrate : card.freightPerCrate)
      : undefined;
    if (agreed === undefined) return;
    const name = { commission: "Commission", hamali: "Hamali", weighment: "Weighment", freight: "Freight" }[c.kind];
    const nameMr = { commission: "अडत", hamali: "हमाली", weighment: "तोलाई", freight: "भाडे" }[c.kind];
    const terms = c.kind === "commission" ? pct(card.commission) : `₹${c.kind === "hamali" ? card.hamaliPerCrate : c.kind === "weighment" ? card.weighmentPerCrate : card.freightPerCrate} a crate`;
    if (c.amount > agreed + 1) {
      const charged = c.kind === "commission" && gross ? ` (${pct(c.amount / gross)})` : crates ? ` (₹${Math.round((c.amount / crates) * 10) / 10} a crate)` : "";
      out.push({ ...base, tone: "flag", extra: c.amount - agreed, card: agreed, en: `${name} ${inr(c.amount)}${charged}; agreed ${terms} is ${inr(agreed)}.`, mr: `${nameMr} ${inrMr(c.amount)}; ठरलेले ${inrMr(agreed)}.` });
    } else {
      out.push({ ...base, tone: "ok", card: agreed, en: `${name} ${inr(c.amount)} is within the agreed ${terms}.`, mr: `${nameMr} ${inrMr(c.amount)} ठरल्याप्रमाणे.` });
    }
  });

  const sum = slip.charges.reduce((a, c) => a + c.amount, 0);
  if (slip.total !== undefined && slip.charges.length && Math.abs(sum - slip.total) > 1) {
    out.push({ id: "total", tone: "flag", extra: Math.max(0, slip.total - sum), en: `The deductions add up to ${inr(sum)}, but the slip totals them as ${inr(slip.total)}.`, mr: `कपातीची बेरीज ${inrMr(sum)}, पण पावतीवर ${inrMr(slip.total)}.` });
  }
  if (gross !== undefined && slip.net !== undefined) {
    const less = slip.total ?? sum;
    const expected = gross - less;
    if (Math.abs(expected - slip.net) > 1) {
      out.push({ id: "net", tone: "flag", extra: Math.max(0, expected - slip.net), en: `${inr(gross)} less ${inr(less)} is ${inr(expected)}, but the slip pays ${inr(slip.net)}.`, mr: `${inrMr(gross)} वजा ${inrMr(less)} = ${inrMr(expected)}, पण पावतीवर ${inrMr(slip.net)}.` });
    } else {
      out.push({ id: "net", tone: "ok", en: `Net adds up: ${inr(gross)} less ${inr(less)} is ${inr(slip.net)}.`, mr: `निव्वळ रक्कम बरोबर: ${inrMr(slip.net)}.` });
    }
  }
  return out;
}

export const owed = (checks: Check[]) => checks.reduce((a, c) => a + (c.tone === "flag" ? (c.extra ?? 0) : 0), 0);

export function toSaleSlip(slip: Slip, checks: Check[], plot: number, fallbackDay: number): SaleSlip | null {
  const { crates, kg, rate, gross } = slip;
  if (!crates || !kg || !rate || gross === undefined) return null;
  const deductions = slip.charges.map((c, i) => ({ label: c.label, amount: c.amount, card: checks.find((k) => k.charge === i)?.card }));
  const net = slip.net ?? gross - deductions.reduce((a, d) => a + d.amount, 0);
  return {
    id: `slip-${plot}-${slip.pattiNo ?? slip.day ?? fallbackDay}-${Math.round(gross)}`,
    plot,
    day: slip.day ?? fallbackDay,
    market: slip.market,
    pattiNo: slip.pattiNo,
    agent: slip.agent,
    crates,
    kg,
    grade: slip.grade ?? "A",
    pricePerKg: rate,
    gross,
    deductions,
    net,
    aboveCard: owed(checks),
    flags: checks.filter((c) => c.tone === "flag").map((c) => c.en),
  };
}

/** The note a farmer can show the agent or send to the officer, in both languages. */
export function disputeNote(slip: Slip, checks: Check[]) {
  const flags = checks.filter((c) => c.tone === "flag");
  const head = `Patti ${slip.pattiNo ?? "(no number)"}${slip.date ? `, ${slip.date}` : ""}${slip.agent ? `, ${slip.agent}` : ""}`;
  return {
    en: `${head}: ${flags.map((f) => f.en).join(" ")} Please refund ${inr(owed(checks))}.`,
    mr: `पट्टी ${slip.pattiNo ?? ""}: ${flags.map((f) => f.mr).join(" ")} कृपया ${inrMr(owed(checks))} परत करा.`,
  };
}
