import { SPRAYS } from "@/lib/sim/rules";
import type { Fact } from "./tools";

/**
 * Deterministic checks on every drafted answer before it reaches a farmer. A language model may
 * phrase and explain; it may not invent a product, a dose, a date or a number.
 */
export type GuardReport = {
  passed: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
  ungrounded: string[];
  blocked: string[];
};

const BANNED = [/strepto/i, /tetracycl/i, /streptomycin/i, /antibiotic/i, /plantomycin/i, /bronopol/i, /carbendazim/i, /mancozeb/i, /imidacloprid/i, /chlorpyri/i];
const PRODUCT = /\b(copper\s+(?:hydroxide|oxychloride|sulphate|sulfate)|bordeaux|kocide|blitox|fungicide|bactericide|insecticide|pesticide)\b/gi;
const DOSE = /(\d+(?:\.\d+)?)\s*(?:g|gm|gram|grams|ml|kg)\s*(?:\/|per)\s*(?:l\b|litre|liter|10\s*l)/gi;

const MONTHS = "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC";
const DATE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})[A-Z]*\\b`, "gi");
const NUMBER_UNIT = /(?:₹\s?)?\d[\d,]*(?:\.\d+)?\s*(?:mm|kl|kL|km|%|kg|crates?|litres?|hours?|h\b|°C|t\b|tonnes?|days?|\/kg)/gi;

const norm = (t: string) => t.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");

export function guard(answer: string, facts: Fact[]): GuardReport {
  const corpus = norm(facts.map((f) => f.text).join(" \n "));
  const allowedDoses = [SPRAYS.curative.dose, SPRAYS.preventive.dose].map(norm).join(" ");
  const checks: GuardReport["checks"] = [];
  const blocked: string[] = [];

  for (const re of BANNED) {
    const m = answer.match(re);
    if (m) blocked.push(m[0]);
  }
  checks.push({ name: "No banned or unreviewed chemicals", ok: blocked.length === 0, detail: blocked.length ? `mentions ${blocked.join(", ")}` : "none mentioned" });

  const doses = [...answer.matchAll(DOSE)].map((m) => m[0]);
  const badDoses = doses.filter((d) => !allowedDoses.includes(norm(d).replace(/gm|grams?/, "g").replace(/\/|per/, "per").replace(/liter|litre|\bl\b/, "litre")) && !corpus.includes(norm(d)));
  checks.push({ name: "Doses only from the spray table", ok: badDoses.length === 0, detail: badDoses.length ? `not in the table: ${badDoses.join("; ")}` : doses.length ? `${doses.length} dose${doses.length > 1 ? "s" : ""}, all from the table` : "no dose stated" });

  const products = [...new Set([...answer.matchAll(PRODUCT)].map((m) => m[0].toLowerCase()))];
  const badProducts = products.filter((p) => !corpus.includes(p) && !["fungicide", "bactericide", "pesticide", "insecticide"].includes(p));
  checks.push({ name: "Products only from the spray table", ok: badProducts.length === 0, detail: badProducts.length ? `not in the evidence: ${badProducts.join(", ")}` : products.length ? "all from the table" : "no product named" });

  const ungrounded: string[] = [];
  const dates = [...answer.matchAll(DATE)].map((m) => `${Number(m[1])} ${m[2].slice(0, 3).toUpperCase()}`);
  const corpusDates = new Set([...facts.map((f) => f.text).join(" ").matchAll(DATE)].map((m) => `${Number(m[1])} ${m[2].slice(0, 3).toUpperCase()}`));
  for (const d of new Set(dates)) if (!corpusDates.has(d)) ungrounded.push(d);
  const nums = [...answer.matchAll(NUMBER_UNIT)].map((m) => m[0]);
  for (const n of new Set(nums)) {
    const digits = n.replace(/[^\d.]/g, "");
    if (!digits || Number(digits) <= 1) continue;
    // Accept the number if it appears in the evidence, as written or rounded.
    const v = Number(digits);
    const variants = [digits, String(Math.round(v)), v.toFixed(1), String(Math.round(v / 1000))];
    if (!variants.some((x) => corpus.includes(x))) ungrounded.push(n.trim());
  }
  checks.push({ name: "Every date and number is in the evidence", ok: ungrounded.length === 0, detail: ungrounded.length ? `not found: ${ungrounded.join(", ")}` : `${dates.length + nums.length} checked` });

  return { passed: checks.every((c) => c.ok), checks, ungrounded, blocked };
}
