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
/** `unread`: the amount could not be read and waits for the farmer; `repaired`: the misread value the line's own arithmetic corrected. */
export type Charge = { label: string; amount: number; kind: ChargeKind; percent?: number; conf: number; box?: Box; unread?: boolean; repaired?: number };
export type Repair = { label: string; from: number; to: number; why: string };

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
  /** Lines the reader did not use: headings, notes, stray marks. */
  skipped: string[];
  /** Gross, total or net printed but not readable: left blank for the farmer. */
  unread: SlipNumber[];
  /** Misreads corrected by the line's own arithmetic, shown to the farmer. */
  repairs: Repair[];
};

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/**
 * One script for numbers: Devanagari digits become ASCII, zero-width joiners go, rupee marks become
 * "Rs", and the gaps OCR leaves inside numbers ("74, 340.,00") close up.
 */
export function normalise(s: string) {
  return s
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/[‌‍]/g, "")
    .replace(/रु\.?|₹/g, "Rs ")
    .replace(/(\d[,.])\s+(?=\d)/g, "$1")
    .replace(/(\d)[.,]{2,}(?=\d)/g, "$1.")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A number as printed on a slip. Indian grouping uses commas, which OCR sometimes reads as points:
 * only a final separator followed by one or two digits is the decimal mark.
 */
export function num(s: string) {
  const t = s.replace(/\s/g, "");
  const m = t.match(/[.,](\d{1,2})$/);
  const whole = (m ? t.slice(0, -m[0].length) : t).replace(/[.,]/g, "");
  return Number(m ? `${whole}.${m[1]}` : whole);
}

const LETTERS = /[A-Za-zऀ-ॿ]{2,}/;
const AMOUNT = /(-?\d[\d,.]*\d|\d)\s*$/;
const lastWordBox = (l: OcrLine) => l.words.at(-1)?.bbox ?? l.bbox;
const lastWordConf = (l: OcrLine) => l.words.at(-1)?.confidence ?? l.confidence;
const GRADE: Record<string, "A" | "B" | "C"> = { A: "A", B: "B", C: "C", अ: "A", ब: "B", क: "C" };

/** Labels in English or Marathi, as computer-printed pattis use them. */
function kindOf(label: string): ChargeKind | "gross" | "total" | "net" | null {
  const l = label.toLowerCase();
  if (/gross|sale amount|bill amount|total sale|एकूण\s*रक्कम|एकूण\s*विक्री|विक्री\s*रक्कम/.test(l)) return "gross";
  if (/total\s*(deduction|exp|charge|kharch)|deductions?\s*total|less\s*total|एकूण\s*(वजावट|खर्च|कपात)/.test(l)) return "total";
  if (/\bnet\b|payable|to pay|balance|निव्वळ|देय|शिल्लक/.test(l)) return "net";
  if (/commission|adat|adt\b|dalali|brokerage|अं?डत|आडत|कमिशन|दलाली/.test(l)) return "commission";
  if (/hamali|hamal|loading|unloading|हमाली/.test(l)) return "hamali";
  if (/\btolai\b|\btulai\b|weigh|तोलाई|तोलणी|काटा/.test(l)) return "weighment";
  if (/motor|freight|bhada|bhade|transport|vahan|gadi|भाडे|वाहतूक|गाडी/.test(l)) return "freight";
  return null;
}

/** Turns OCR lines into a slip. Charges are the amount lines between the gross and the total. */
export function parseSlip(lines: OcrLine[]): Slip {
  const slip: Slip = { market: "phaltan", charges: [], conf: {}, boxes: {}, skipped: [], unread: [], repairs: [] };
  const setNum = (k: SlipNumber, v: number, l: OcrLine, box?: Box, conf?: number) => {
    if (slip[k] !== undefined || !Number.isFinite(v)) return;
    slip[k] = v;
    slip.conf[k] = Math.round(conf ?? l.confidence);
    slip.boxes[k] = box ?? l.bbox;
  };
  const near = (l: OcrLine, digits: string) => l.words.find((w) => normalise(w.text).includes(digits))?.bbox;
  let inCharges = false;
  for (const [i, l] of lines.entries()) {
    const text = normalise(l.text);
    if (!text) continue;
    if (i === 0 && LETTERS.test(text) && !/\d/.test(text)) slip.agent = /[A-Za-z]/.test(text) ? text.replace(/\b(\w)(\w*)/g, (_, a: string, b: string) => a + b.toLowerCase()) : text;
    if (/pune|gultekdi|market yard|पुणे/i.test(text)) slip.market = "pune";
    else if (/vashi|navi mumbai|वाशी/i.test(text)) slip.market = "vashi";

    let used = false;
    const patti = text.match(/(?:patti\s*no\.?|पट्टी\s*क्र\.?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]*)/i);
    if (patti) { slip.pattiNo ??= patti[1]; used = true; }
    const date = text.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (date && !slip.date) {
      const y = Number(date[3].length === 2 ? `20${date[3]}` : date[3]);
      const d = dayOf(y, Number(date[2]) - 1, Number(date[1]));
      slip.date = `${date[1].padStart(2, "0")}/${date[2].padStart(2, "0")}/${y}`;
      if (d >= 0 && d < SEASON_DAYS) slip.day = d;
      used = true;
    }
    const farmer = text.match(/(?:farmer\s*(?:name)?|शेतकरी)\s*[:\-]\s*(.+)$/i);
    if (farmer) { slip.farmer ??= farmer[1].trim(); used = true; }
    const grade = text.match(/(?:grade|प्रत)\s*[:\-]?\s*([ABCअबक])/i);
    if (grade) { slip.grade ??= GRADE[grade[1].toUpperCase()]; used = true; }
    const crates = text.match(/(?:crates?|क्रेट|कॅरेट)\s*[:\-]\s*(\d{1,4})/i) ?? text.match(/\b(\d{1,4})\s*crates?\b/i);
    if (crates) { setNum("crates", Number(crates[1]), l, near(l, crates[1])); used = true; }
    const kg = text.match(/(?:weight|वजन)\s*[:\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:kg|किलो)/i) ?? text.match(/(\d[\d,]*(?:\.\d+)?)\s*kg\b(?!\s*\/)/i);
    if (kg) { setNum("kg", num(kg[1]), l, near(l, kg[1])); used = true; }
    const rate = text.match(/(?:rate|भाव|दर\s*[:\-])\s*[:\-]?\s*(?:rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)/i);
    if (rate) { setNum("rate", num(rate[1]), l, near(l, rate[1])); used = true; }

    const amount = text.match(AMOUNT);
    const label = amount ? text.slice(0, amount.index).trim() : "";
    const kind = amount && LETTERS.test(label) ? kindOf(label) : null;
    // A number with stray characters stuck to it ("&,340.00") was not read: leave it for the farmer.
    const token = text.split(" ").at(-1) ?? "";
    const clean = /^-?[\d.,]+$/.test(token);
    // Headings such as "Commission Agent, Shop 14" carry numbers too: charges count only after the gross.
    if (amount && kind && (kind === "gross" || kind === "total" || kind === "net" || inCharges)) {
      const v = num(amount[1]);
      if (kind === "gross" || kind === "total" || kind === "net") {
        if (clean) setNum(kind, v, l, lastWordBox(l), lastWordConf(l));
        else { slip.unread.push(kind); slip.conf[kind] = 0; slip.boxes[kind] = lastWordBox(l); }
        inCharges = kind === "gross";
      } else {
        const pct = label.match(/(\d+(?:\.\d+)?)\s*%/);
        slip.charges.push({ label, amount: clean ? v : 0, kind, percent: pct ? Number(pct[1]) : undefined, conf: clean ? Math.round(lastWordConf(l)) : 0, box: lastWordBox(l), unread: !clean || undefined });
      }
      used = true;
    } else if (amount && inCharges && LETTERS.test(label)) {
      // An amount line between gross and total that is not on the rate card.
      slip.charges.push({ label, amount: clean ? num(amount[1]) : 0, kind: "other", conf: clean ? Math.round(lastWordConf(l)) : 0, box: lastWordBox(l), unread: !clean || undefined });
      used = true;
    }
    if (!used && !/^(less|वजावट)/i.test(text) && i > 1) slip.skipped.push(text);
  }
  return repairSlip(slip);
}

/** Every number one digit away: the misreads OCR makes (५ for ७, 3 for 8 …). */
function oneDigitAway(n: number) {
  const s = String(Math.round(n));
  const out = new Set<number>();
  for (let i = 0; i < s.length; i++) for (let d = 0; d <= 9; d++) if (String(d) !== s[i] && !(i === 0 && d === 0)) out.add(Number(s.slice(0, i) + d + s.slice(i + 1)));
  return out;
}

/**
 * Corrects a misread only when the line proves itself: "Hamali 63 x 5" must be 315, "Adat 6%" must be
 * 6% of the gross, and the gross must be weight × rate. The number must also have been read with low
 * confidence (under 90%) and be one digit away, or read so poorly (under 50%) that it cannot be trusted at all. Totals and the net are never corrected: that is where a real
 * overcharge would hide, so a disagreement there is always shown to the farmer.
 */
export function repairSlip(slip: Slip): Slip {
  const repairs: Repair[] = [];
  let gross = slip.gross;
  if (gross !== undefined && slip.kg && slip.rate && (slip.conf.gross ?? 100) < 90) {
    const expected = Math.round(slip.kg * slip.rate);
    if (Math.abs(expected - gross) > 1 && oneDigitAway(gross).has(expected)) {
      repairs.push({ label: "Gross", from: gross, to: expected, why: `${slip.kg} kg × ₹${slip.rate}` });
      gross = expected;
    }
  }
  const charges = slip.charges.map((c) => {
    if (c.unread || c.conf >= 90) return c;
    const mul = c.label.match(/(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
    const expected = mul ? Math.round(Number(mul[1]) * Number(mul[2])) : c.kind === "commission" && c.percent && gross ? Math.round((gross * c.percent) / 100) : undefined;
    if (expected === undefined || Math.abs(expected - c.amount) <= 1 || (c.conf >= 50 && !oneDigitAway(c.amount).has(expected))) return c;
    repairs.push({ label: c.label, from: c.amount, to: expected, why: mul ? `${mul[1]} × ${mul[2]}` : `${c.percent}% of ₹${gross?.toLocaleString("en-IN")}` });
    return { ...c, amount: expected, repaired: c.amount };
  });
  // One weak line and a clearly read total: the total less the other lines gives that line, if the digits
  // read agree (or nothing was readable). Never hides money: the amount still lands on a checked line.
  const weak = charges.flatMap((c, i) => (c.unread || c.conf < 60 ? [i] : []));
  if (weak.length === 1 && slip.total !== undefined && (slip.conf.total ?? 0) >= 90) {
    const i = weak[0], c = charges[i];
    const inferred = slip.total - charges.reduce((a, x, j) => a + (j === i ? 0 : x.amount), 0);
    if (inferred > 0 && Math.abs(inferred - c.amount) > 1 && (c.unread || String(Math.round(c.amount)).startsWith(String(Math.round(inferred))))) {
      repairs.push({ label: c.label, from: c.unread ? -1 : c.amount, to: inferred, why: `the total ₹${slip.total.toLocaleString("en-IN")} less the other lines` });
      charges[i] = { ...c, amount: inferred, repaired: c.unread ? undefined : c.amount, unread: undefined };
    }
  }
  return { ...slip, gross, charges, repairs: [...slip.repairs, ...repairs] };
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

  for (const r of slip.repairs) {
    const read = r.from < 0 ? "unreadable" : `read as ${inr(r.from)}`;
    out.push({ id: `fix-${r.label}`, tone: "info", en: `Corrected a misread: ${r.label} ${read}; ${r.why} gives ${inr(r.to)}. Check it on the slip.`, mr: `चुकीचे वाचन दुरुस्त: ${r.label} = ${inrMr(r.to)}. पट्टीवर तपासा.` });
  }
  const unreadCharges = slip.charges.filter((c) => c.unread).length;
  if (unreadCharges || slip.unread.length) {
    out.push({ id: "unread", tone: "info", en: `${unreadCharges + slip.unread.length} ${unreadCharges + slip.unread.length === 1 ? "amount" : "amounts"} could not be read cleanly. Type ${unreadCharges + slip.unread.length === 1 ? "it" : "them"} from the slip; nothing is guessed.`, mr: "काही रकमा स्पष्ट वाचता आल्या नाहीत; पट्टी पाहून भरा." });
  }
  const sum = slip.charges.reduce((a, c) => a + c.amount, 0);
  // A total one digit away from the lines, read with low confidence, is more likely a misread than an
  // overcharge: it is shown as a number to check, not counted as money owed, and the lines' sum is used.
  let totalTrusted = slip.total !== undefined;
  if (!unreadCharges && slip.total !== undefined && slip.charges.length && Math.abs(sum - slip.total) > 1) {
    if ((slip.conf.total ?? 100) < 90 && oneDigitAway(slip.total).has(Math.round(sum))) {
      totalTrusted = false;
      out.push({ id: "total", tone: "info", en: `Check the total on the slip: it was read as ${inr(slip.total)}, unclearly, and the lines add up to ${inr(sum)}.`, mr: `एकूण वजावट पट्टीवर तपासा: वाचन ${inrMr(slip.total)}, बेरीज ${inrMr(sum)}.` });
    } else {
      out.push({ id: "total", tone: "flag", extra: Math.max(0, slip.total - sum), en: `The deductions add up to ${inr(sum)}, but the slip totals them as ${inr(slip.total)}.`, mr: `कपातीची बेरीज ${inrMr(sum)}, पण पावतीवर ${inrMr(slip.total)}.` });
    }
  }
  if (gross !== undefined && slip.net !== undefined && (slip.total !== undefined || !unreadCharges)) {
    const less = totalTrusted ? slip.total! : sum;
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
