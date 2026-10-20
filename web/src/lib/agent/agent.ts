import { fmtDay } from "@/lib/sim/calendar";
import { geo } from "@/lib/geo";
import type { Season } from "@/lib/sim/types";
import { answer as rulesAnswer, type Intent } from "@/lib/voice";
import { guard, type GuardReport } from "./guard";
import { AGENT_MODEL, chat, embed, type ChatMessage } from "./llm";
import { EMBED_PREFIX, route, type Route, type RouteIntent } from "./router";
import { PREFETCH, runTool, TOOL_SPECS, type Fact, type ToolCtx } from "./tools";

/**
 * The Ask pipeline. Five stages, each traced:
 *   1. route      the locally trained router reads the question (English, Marathi or both)
 *   2. evidence   the tools the route needs run first, from the plot's record, weather and rules
 *   3. plan       the local LLM may call more tools (up to three rounds) to fill gaps
 *   4. compose    the LLM writes a structured answer that cites fact ids, under a JSON schema
 *   5. guard      deterministic checks; one repair round; otherwise the rules-based answer
 * With no model server, stages 3 and 4 fall back to the rules-based builder, so Ask never breaks.
 */
export type Audience = "farmer" | "officer";
export type AgentStep = { stage: "route" | "evidence" | "plan" | "compose" | "guard" | "repair" | "fallback" | "translate"; label: string; ms: number; detail?: unknown };
export type AgentAnswer = {
  question: string;
  audience: Audience;
  route: Route;
  headline: string;
  steps: string[];
  why: { text: string; cite: string[] }[];
  mr?: string;
  mrSource?: "template" | "model";
  citations: Fact[];
  confidence: "high" | "medium" | "low";
  escalate: boolean;
  guard: GuardReport;
  engine: "llm" | "rules";
  model: string;
  ms: number;
  tokens: number;
  trace: AgentStep[];
};

const TEMPLATE_INTENT: Partial<Record<RouteIntent, Intent>> = { spray_failed: "spray-failed", next_spray: "when-spray", irrigation: "irrigation", harvest_market: "harvest", blight_risk: "blight" };

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One sentence that answers the question directly, with the date and time if there is an action" },
    do_this: { type: "array", items: { type: "string" }, maxItems: 3, description: "Up to three concrete steps, each with when to do it" },
    why: { type: "array", maxItems: 3, items: { type: "object", properties: { text: { type: "string" }, fact_ids: { type: "array", items: { type: "string" } } }, required: ["text", "fact_ids"] } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    escalate: { type: "boolean", description: "true if the facts cannot answer this and an extension officer should" },
  },
  required: ["headline", "do_this", "why", "confidence", "escalate"],
};

type Draft = { headline: string; do_this: string[]; why: { text: string; fact_ids: string[] }[]; confidence: "high" | "medium" | "low"; escalate: boolean };

function systemPrompt(s: Season, plot: number, day: number, audience: Audience) {
  const p = s.plots[plot];
  const v = geo.villages[p.village];
  const who = audience === "farmer"
    ? `You answer ${p.farmer.name}, a pomegranate grower, about her plot: gat ${p.gat}, ${v.name}, Phaltan taluka. Write for a farmer: plain words, short sentences, no jargon.`
    : `You draft a reply for the extension officer to send to ${p.farmer.name} (gat ${p.gat}, ${v.name}). The officer will edit it. Be precise and practical.`;
  return [
    `You are KhetKundli's farm assistant. Today is ${fmtDay(day)} 2026. ${who}`,
    "Rules you must follow:",
    "1. Use only the facts returned by the tools. Never invent a date, amount, price, product or dose.",
    "2. Spray products and doses come only from the spray_rule tool. Never suggest antibiotics or any other chemical.",
    "3. Give times as they appear in the facts, for example '22 OCT 06:00'.",
    "4. If the facts cannot answer the question, or it is outside crop care, weather, water, harvest, markets, transport, sale slips or export, set escalate to true and say the officer will reply.",
    "5. Cite the ids of the facts that support each reason.",
    "6. Write in English; a reviewed Marathi version is added separately. The headline answers the question in one sentence; never repeat the question.",
    "7. Quote a product and its dose exactly as the spray_rule fact gives them, once.",
    "8. Be specific: every step names the exact date and time from the facts (for example 'Spray on 22 OCT at 06:00'), and every reason quotes the dates and amounts from the record (for example '24 mm of rain on 21 SEP').",
  ].join("\n");
}

const factBlock = (facts: Fact[]) => facts.map((f) => `[${f.id}] ${f.text}`).join("\n");

function dedupe(facts: Fact[]) {
  const seen = new Map<string, Fact>();
  for (const f of facts) seen.set(f.id, f);
  return [...seen.values()];
}

function render(d: Draft) {
  return [d.headline, ...d.do_this, ...d.why.map((w) => w.text)].join("\n");
}

const FACT_HEADLINE: Partial<Record<RouteIntent, string>> = {
  weather: "Here is the weather your record uses for Phaltan:",
  export: "Here is what your record says about export:",
  sale_slip: "Here is what your sales and the agreed rate card say:",
  transport: "Here is what your record says about transport:",
};

function rulesDraft(s: Season, plot: number, day: number, question: string, r: Route, facts: Fact[] = []): { draft: Draft; mr: string; escalate: boolean } {
  const a = rulesAnswer(s, plot, day, question);
  const mapped = TEMPLATE_INTENT[r.intent];
  // Intents without a reviewed template answer with the facts themselves, word for word.
  if (!mapped && a.intent === "unknown" && r.intent !== "other" && facts.length) {
    const pick = facts.filter((f) => f.source !== "knowledge" && f.id !== "plot" && f.id !== "stage").slice(0, 3);
    return {
      draft: { headline: FACT_HEADLINE[r.intent] ?? "Here is what your record says:", do_this: pick.map((f) => f.text), why: [], confidence: "medium", escalate: false },
      mr: "",
      escalate: false,
    };
  }
  const use = mapped && a.intent === "unknown" ? rulesAnswer(s, plot, day, mappedProbe(mapped)) : a;
  const sentences = use.en.split(/(?<=\.)\s+/);
  return {
    draft: { headline: sentences[0], do_this: sentences.slice(1, 3), why: use.sources.map((t) => ({ text: t, fact_ids: [] })), confidence: use.escalate ? "low" : "high", escalate: use.escalate },
    mr: use.mr,
    escalate: use.escalate,
  };
}

/** A canonical question for a routed intent, so the rules builder answers what the router understood. */
function mappedProbe(i: Intent) {
  return { "spray-failed": "why did my last spray fail", "when-spray": "when should I spray", irrigation: "should I irrigate", harvest: "when do I harvest and where to sell", blight: "is there blight", unknown: "" }[i];
}

export async function runAgent(
  input: { question: string; season: Season; plot: number; day: number; audience?: Audience; useLlm?: boolean },
  emit: (step: AgentStep) => void = () => {},
): Promise<AgentAnswer> {
  const t0 = performance.now();
  const { question, season: s, plot, day } = input;
  const audience = input.audience ?? "farmer";
  const trace: AgentStep[] = [];
  const step = (st: AgentStep) => { trace.push(st); emit(st); };
  let tokens = 0;

  // 1. Route.
  let t = performance.now();
  let qvec: number[] | null = null;
  try { [qvec] = await embed([EMBED_PREFIX + question]); } catch { qvec = null; }
  const r = route(question, qvec);
  step({ stage: "route", label: `${r.intent.replace("_", " ")} · ${Math.round(r.confidence * 100)}% · ${r.lang === "mr" ? "Marathi" : r.lang === "mixed" ? "Marathi and English" : "English"}`, ms: performance.now() - t, detail: { probs: r.probs, models: r.models } });

  // 2. Evidence the route needs.
  t = performance.now();
  const ctx: ToolCtx = { season: s, plot, day };
  let facts: Fact[] = [];
  const pre = [...(PREFETCH[r.intent] ?? []), ...(r.confidence < 0.45 ? PREFETCH.blight_risk : []), ["plot_profile", {}] as [string, Record<string, unknown>]];
  const ran = new Set<string>();
  for (const [name, args] of pre) {
    const key = `${name}:${JSON.stringify(args)}`;
    if (ran.has(key)) continue;
    ran.add(key);
    facts.push(...(await runTool(name, ctx, args)).facts);
  }
  facts = dedupe(facts);
  step({ stage: "evidence", label: `${ran.size} tools · ${facts.length} facts`, ms: performance.now() - t, detail: [...ran].map((k) => k.split(":")[0]) });

  const fallback = (why: string, report?: GuardReport): AgentAnswer => {
    const rb = rulesDraft(s, plot, day, question, r, facts);
    step({ stage: "fallback", label: why, ms: 0 });
    const g = report ?? guard(render(rb.draft), facts);
    return {
      question, audience, route: r, headline: rb.draft.headline, steps: rb.draft.do_this, why: rb.draft.why.map((w) => ({ text: w.text, cite: [] })),
      mr: rb.mr || undefined, mrSource: rb.mr ? "template" : undefined, citations: facts.slice(0, 6), confidence: rb.draft.confidence, escalate: rb.escalate || r.intent === "other",
      guard: g, engine: "rules", model: "rules table + record", ms: performance.now() - t0, tokens, trace,
    };
  };

  if (input.useLlm === false) return fallback("Rules-based answer (model not requested)");

  // 3. Plan: the model may ask for more evidence.
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(s, plot, day, audience) },
    { role: "user", content: `Question: ${question}\n\nFacts gathered so far:\n${factBlock(facts)}\n\nIf you need more facts, call the tools. Otherwise reply DONE.` },
  ];
  try {
    // A confident route already fetched what it needs; spend model time only on unclear questions.
    if (r.confidence >= 0.75 && r.intent !== "other") step({ stage: "plan", label: "Skipped: the route's evidence is enough", ms: 0 });
    else for (let round = 0; round < 3; round++) {
      t = performance.now();
      const res = await chat(messages, { tools: TOOL_SPECS, numPredict: 200 });
      tokens += res.evalCount ?? 0;
      const calls = res.message.tool_calls ?? [];
      if (!calls.length) { step({ stage: "plan", label: round ? "Enough evidence" : "Evidence is enough", ms: performance.now() - t }); break; }
      messages.push(res.message);
      const names: string[] = [];
      for (const c of calls.slice(0, 3)) {
        const out = await runTool(c.function.name, ctx, c.function.arguments ?? {});
        facts = dedupe([...facts, ...out.facts]);
        names.push(c.function.name);
        messages.push({ role: "tool", tool_name: c.function.name, content: factBlock(out.facts) || JSON.stringify(out.data) });
      }
      step({ stage: "plan", label: `Called ${names.join(", ")}`, ms: performance.now() - t, detail: calls.map((c) => c.function) });
    }
  } catch (err) {
    return fallback(`Model unavailable (${String(err).slice(0, 80)}); rules-based answer`);
  }

  // 4. Compose under the JSON schema.
  const compose = async (extra = ""): Promise<Draft> => {
    const res = await chat(
      [
        { role: "system", content: systemPrompt(s, plot, day, audience) },
        { role: "user", content: `Question: ${question}\n\nFacts (cite their ids):\n${factBlock(facts)}\n\nWrite the answer as JSON. Keep it under 90 words in all.${extra}` },
      ],
      { format: SCHEMA, temperature: 0.1, numPredict: 450 },
    );
    tokens += res.evalCount ?? 0;
    return JSON.parse(res.message.content) as Draft;
  };
  let draft: Draft;
  t = performance.now();
  try {
    draft = await compose();
  } catch (err) {
    return fallback(`Compose failed (${String(err).slice(0, 80)}); rules-based answer`);
  }
  step({ stage: "compose", label: `${draft.do_this.length} steps · ${draft.why.length} reasons · ${draft.confidence} confidence`, ms: performance.now() - t });

  // 5. Guard, with one repair round.
  t = performance.now();
  let g = guard(render(draft), facts);
  step({ stage: "guard", label: g.passed ? "All checks passed" : g.checks.filter((c) => !c.ok).map((c) => c.detail).join("; "), ms: performance.now() - t, detail: g.checks });
  if (!g.passed) {
    t = performance.now();
    try {
      draft = await compose(`\n\nYour previous draft failed these checks: ${g.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`).join("; ")}. Use only values that appear in the facts.`);
      g = guard(render(draft), facts);
      step({ stage: "repair", label: g.passed ? "Repaired; all checks passed" : "Still failing", ms: performance.now() - t, detail: g.checks });
    } catch {
      /* fall through */
    }
    if (!g.passed) return fallback("Draft failed the checks twice; rules-based answer", undefined);
  }

  // Marathi: the reviewed template where the intent has one; otherwise the model's translation, marked as such.
  let mr: string | undefined;
  let mrSource: AgentAnswer["mrSource"];
  if (r.lang !== "en" && audience === "farmer") {
    const mapped = TEMPLATE_INTENT[r.intent];
    if (mapped) {
      mr = rulesAnswer(s, plot, day, mappedProbe(mapped)).mr;
      mrSource = "template";
    } else {
      t = performance.now();
      try {
        const res = await chat([{ role: "system", content: "Translate into simple, natural Marathi (Devanagari) for a farmer. Keep numbers, dates and product names exactly as written. Reply with the translation only." }, { role: "user", content: render(draft) }], { numPredict: 300 });
        tokens += res.evalCount ?? 0;
        mr = res.message.content.trim();
        mrSource = "model";
        step({ stage: "translate", label: "Marathi by the model (to be checked)", ms: performance.now() - t });
      } catch { /* English only */ }
    }
  }

  const cited = new Set(draft.why.flatMap((w) => w.fact_ids));
  return {
    question, audience, route: r,
    headline: draft.headline, steps: draft.do_this, why: draft.why.map((w) => ({ text: w.text, cite: w.fact_ids.filter((id) => facts.some((f) => f.id === id)) })),
    mr, mrSource,
    citations: facts.filter((f) => cited.has(f.id)).concat(facts.filter((f) => !cited.has(f.id) && f.source !== "knowledge").slice(0, Math.max(0, 4 - cited.size))),
    confidence: draft.confidence,
    escalate: draft.escalate || r.intent === "other",
    guard: g, engine: "llm", model: AGENT_MODEL, ms: performance.now() - t0, tokens, trace,
  };
}
