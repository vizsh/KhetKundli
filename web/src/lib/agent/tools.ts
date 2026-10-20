import { fmtDay, SEASON_DAYS } from "@/lib/sim/calendar";
import { geo, kmBetween, routeByHub } from "@/lib/geo";
import { blightStatus, stageOf } from "@/lib/sim/selectors";
import { COMMISSION, EXPORT_PHI_DAYS, firstSprayWindow, HAMALI_PER_CRATE, KC, markets, SPRAY_SOURCE, SPRAYS, sprayable, STAGE_LABEL, WEIGHMENT_PER_CRATE } from "@/lib/sim/rules";
import type { MarketId, PlotEvent, Season } from "@/lib/sim/types";
import type { ToolSpec } from "./llm";
import { searchKb } from "./kb";

/**
 * The agent's tools. Each reads the plot's season record, the weather or the rules table and
 * returns data plus short, citable facts with ids. The answer may only state what these facts say:
 * the guard checks every date, number and dose in the draft against them.
 */
export type Fact = { id: string; text: string; source: "record" | "weather" | "rules" | "radar" | "market" | "knowledge" };
export type ToolResult = { data: unknown; facts: Fact[] };
export type ToolCtx = { season: Season; plot: number; day: number };
type Tool = { spec: ToolSpec; run: (ctx: ToolCtx, args: Record<string, unknown>) => Promise<ToolResult> | ToolResult };

const hh = (h: number) => `${String(Math.round(h)).padStart(2, "0")}:00`;
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : d);

export function describeEvent(e: PlotEvent, s: Season): string {
  const when = `${fmtDay(e.day)} ${hh(e.hour)}`;
  switch (e.type) {
    case "spray": return `Spray ${when}: ${e.product}, ${e.dose}${e.washedOff ? `, washed off by ${s.weather[e.day].rainMm.toFixed(0)} mm of rain that day` : ""} (${e.reason})`;
    case "scan": return `Leaf scan ${when}: ${e.finding.replace("-", " ")}, ${Math.round(e.confidence * 100)}% sure${e.offline ? ", scanned offline" : ""}`;
    case "irrigate": return `Irrigated ${when}: ${(e.litres / 1000).toFixed(1)} kL by drip`;
    case "irrigate-skip": return `Irrigation skipped ${when}: ${(e.litresSaved / 1000).toFixed(1)} kL kept (${e.reason})`;
    case "advisory": return `Advisory ${when}: ${e.text}`;
    case "pick": return `Picking ${e.picking} on ${fmtDay(e.day)}: ${e.crates} crates, grade ${e.grade}`;
    case "booking": return `Booked ${e.crates} crates on run ${e.run} from ${e.hub} to ${e.market}, ${fmtDay(e.day)}`;
    case "sale": return `Sale ${fmtDay(e.day)} at ${e.market}: ${e.crates} crates at ₹${e.pricePerKg}/kg, gross ₹${e.gross.toLocaleString("en-IN")}, net ₹${e.net.toLocaleString("en-IN")}${e.slip ? `, slip checked: ₹${e.slip.aboveCard} above the card` : ""}`;
    case "bahar": return `Bahar ${fmtDay(e.day)}: ${e.note}`;
    case "voice": return `Question ${when}: ${e.question}`;
  }
}

const eventFact = (e: PlotEvent, s: Season): Fact => ({ id: e.id, text: describeEvent(e, s), source: "record" });

const weatherFact = (s: Season, d: number): Fact => {
  const w = s.weather[d];
  const kind = w.observed ? "recorded" : w.live ? "forecast" : "simulated";
  return {
    id: `wx-${d}`,
    source: "weather",
    text: `${fmtDay(d)} (${kind}): rain ${w.rainMm.toFixed(1)} mm, chance ${Math.round(w.rainProb * 100)}%, wind ${Math.round(w.windKmh)} km/h, max ${Math.round(w.tMax)} °C${w.wetHours !== undefined ? `, canopy wet ${Math.round(w.wetHours)} h` : ""}${sprayable(w) ? ", sprayable" : ""}`,
  };
};

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolSpec => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOLS: Record<string, Tool> = {
  plot_profile: {
    spec: fn("plot_profile", "The farmer's plot: gat number, village, area, irrigation, soil, bahar date, crop stage today and expected harvest."),
    run: ({ season: s, plot, day }) => {
      const p = s.plots[plot];
      const v = geo.villages[p.village];
      const stage = STAGE_LABEL[stageOf(s, plot, day)].en;
      return {
        data: { gat: p.gat, village: v.name, acres: p.acres, drip: p.drip, soil: p.soil, baharStart: fmtDay(p.baharStart), stage, harvestStart: fmtDay(p.harvestStart), expectedTonnes: p.expectedTonnes, today: fmtDay(day) },
        facts: [
          { id: "plot", source: "record", text: `Gat ${p.gat}, ${v.name}: ${p.acres} acres, ${p.drip ? "drip" : "flood"} irrigation, ${p.soil} soil, ${p.farmer.name}` },
          { id: "stage", source: "record", text: `Bahar on ${fmtDay(p.baharStart)}; stage on ${fmtDay(day)}: ${stage}; first picking expected ${fmtDay(p.harvestStart)}, about ${p.expectedTonnes.toFixed(1)} t` },
        ],
      };
    },
  },

  plot_record: {
    spec: fn("plot_record", "Entries in the plot's season record (sprays, scans, irrigation, advisories, pickings, sales), newest first.", {
      kinds: { type: "array", items: { type: "string", enum: ["spray", "scan", "irrigate", "irrigate-skip", "advisory", "pick", "booking", "sale"] }, description: "Which kinds of entry; all if empty" },
      days_back: { type: "number", description: "How many days back from today (default 45)" },
    }),
    run: ({ season: s, plot, day }, a) => {
      const kinds = Array.isArray(a.kinds) && a.kinds.length ? new Set(a.kinds as string[]) : null;
      const back = num(a.days_back, 45);
      const evs = s.eventsByPlot[plot].filter((e) => e.day <= day && e.day >= day - back && (!kinds || kinds.has(e.type)) && e.type !== "voice").slice(-12).reverse();
      return { data: evs.map((e) => ({ id: e.id, line: describeEvent(e, s), by: e.by })), facts: evs.map((e) => eventFact(e, s)) };
    },
  },

  weather: {
    spec: fn("weather", "Daily weather at Phaltan: recorded days before today and the forecast ahead (rain, chance, wind, temperature, wet-canopy hours).", {
      days_back: { type: "number", description: "Recorded days before today (default 3)" },
      days_ahead: { type: "number", description: "Forecast days from today (default 5)" },
    }),
    run: ({ season: s, day }, a) => {
      const from = Math.max(0, day - num(a.days_back, 3));
      const to = Math.min(SEASON_DAYS - 1, day + num(a.days_ahead, 5));
      const facts: Fact[] = [];
      for (let d = from; d <= to; d++) facts.push(weatherFact(s, d));
      return { data: facts.map((f) => f.text), facts };
    },
  },

  spray_window: {
    spec: fn("spray_window", "The next morning when a spray will set (rain under 1 mm, rain chance under 45%, wind under 15 km/h, max under 36 °C), and any spray already planned in the record."),
    run: ({ season: s, plot, day }) => {
      const planned = s.eventsByPlot[plot].find((e): e is Extract<PlotEvent, { type: "spray" }> => e.type === "spray" && e.day >= day && !e.washedOff);
      const window = firstSprayWindow(s.weather, day + (planned && planned.day === day ? 0 : 1));
      const facts: Fact[] = [];
      if (planned) facts.push({ id: planned.id, source: "record", text: `Planned in the record: ${describeEvent(planned, s)}` });
      facts.push({ id: "window", source: "weather", text: window === null ? "No sprayable morning in the next six days" : `First sprayable morning: ${fmtDay(window)} at 06:00` });
      for (let d = day; d <= Math.min(SEASON_DAYS - 1, day + 4); d++) facts.push(weatherFact(s, d));
      return { data: { planned: planned ? describeEvent(planned, s) : null, window: window === null ? null : `${fmtDay(window)} 06:00` }, facts };
    },
  },

  spray_rule: {
    spec: fn("spray_rule", "The ONLY source of spray products and doses: the fixed table for bacterial blight. Never state a product or dose that is not returned here.", {
      kind: { type: "string", enum: ["curative", "preventive"], description: "curative after blight is confirmed on the plot; preventive when it is near or as routine" },
    }, ["kind"]),
    run: (_ctx, a) => {
      const kind = a.kind === "curative" ? "curative" : "preventive";
      const r = SPRAYS[kind];
      return {
        data: { kind, product: r.product, dose: r.dose, repeat: "15 days", exportPhiDays: EXPORT_PHI_DAYS, source: SPRAY_SOURCE },
        facts: [
          { id: `rule-${kind}`, source: "rules", text: `${kind === "curative" ? "Curative" : "Preventive"} spray: ${r.product}, ${r.dose}; repeat after 15 days` },
          { id: "rule-phi", source: "rules", text: `Copper sprays need ${EXPORT_PHI_DAYS} days before an export picking (APEDA list)` },
          { id: "rule-source", source: "rules", text: SPRAY_SOURCE },
        ],
      };
    },
  },

  blight_status: {
    spec: fn("blight_status", "Bacterial blight on and around the plot: what the record shows, the Pest Radar level in the plot's cell, and blight scans reported in the last 14 days within 5 km."),
    run: ({ season: s, plot, day }) => {
      const p = s.plots[plot];
      const st = blightStatus(s, plot, day);
      const level = ["clear", "watch", "warning", "outbreak"][s.hexRisk[day][p.hex]];
      const near = s.plots
        .map((q, i) => ({ q, i, km: kmBetween(p.at, q.at) }))
        .filter(({ i, km }) => i !== plot && km <= 5)
        .flatMap(({ i, km }) => s.eventsByPlot[i].filter((e) => e.type === "scan" && e.finding === "bacterial-blight" && e.day <= day && e.day > day - 14).map((e) => ({ e, km })));
      const villages = [...new Set(near.map(({ e }) => geo.villages[s.plots[e.plot].village].name))];
      return {
        data: { status: st.label, radarLevel: level, scansWithin5km: near.length, villages },
        facts: [
          { id: "blight-status", source: "record", text: `On ${fmtDay(day)}: ${st.label}` },
          { id: "radar", source: "radar", text: `Pest Radar in the plot's cell on ${fmtDay(day)}: ${level}` },
          { id: "near", source: "radar", text: near.length ? `${near.length} blight scan${near.length > 1 ? "s" : ""} reported within 5 km in the last 14 days (${villages.join(", ")}); nearest ${Math.min(...near.map((n) => n.km)).toFixed(1)} km` : "No blight scans reported within 5 km in the last 14 days" },
        ],
      };
    },
  },

  irrigation_plan: {
    spec: fn("irrigation_plan", "The plot's next irrigation or skip in the coming week, litres, and the crop coefficient for the stage."),
    run: ({ season: s, plot, day }) => {
      const next = s.eventsByPlot[plot].filter((e) => e.day >= day && e.day <= day + 7 && (e.type === "irrigate" || e.type === "irrigate-skip")).slice(0, 3);
      const stage = stageOf(s, plot, day);
      const facts: Fact[] = next.map((e) => eventFact(e, s));
      facts.push({ id: "kc", source: "rules", text: `Crop coefficient for ${STAGE_LABEL[stage].en.toLowerCase()}: ${KC[stage]}; ET0 on ${fmtDay(day)} ${s.weather[day].et0.toFixed(1)} mm` });
      if (!next.length) facts.push({ id: "no-irrigation", source: "record", text: "No irrigation planned in the next 7 days" });
      for (let d = day; d <= Math.min(SEASON_DAYS - 1, day + 2); d++) facts.push(weatherFact(s, d));
      return { data: next.map((e) => describeEvent(e, s)), facts };
    },
  },

  harvest_markets: {
    spec: fn("harvest_markets", "Expected pickings, and prices at Phaltan, Pune and Vashi around the first picking, with freight and commission to compare what the farmer keeps."),
    run: ({ season: s, plot, day }) => {
      const p = s.plots[plot];
      const hub = geo.villages[p.village].hub;
      const mk = markets(routeByHub.get(hub)?.km ?? 15);
      const at = Math.max(day, p.harvestStart);
      const picks = s.eventsByPlot[plot].filter((e) => e.type === "pick" && e.day >= day).slice(0, 4);
      const facts: Fact[] = picks.map((e) => eventFact(e, s));
      const rows = (Object.keys(mk) as MarketId[]).map((id) => {
        const price = s.prices[id][Math.min(SEASON_DAYS - 1, at)];
        const keep = price - mk[id].freightPerCrate / 20 - price * mk[id].commission;
        facts.push({ id: `price-${id}`, source: "market", text: `${mk[id].name} on ${fmtDay(at)}: ₹${price}/kg grade A (simulated); freight ₹${mk[id].freightPerCrate} a crate, commission ${Math.round(mk[id].commission * 100)}%; keeps about ₹${keep.toFixed(0)}/kg` });
        return { market: mk[id].name, price, keep: Math.round(keep) };
      });
      facts.push({ id: "harvest", source: "record", text: `First picking expected ${fmtDay(p.harvestStart)}` });
      return { data: { pickings: picks.map((e) => describeEvent(e, s)), markets: rows }, facts };
    },
  },

  sale_slips: {
    spec: fn("sale_slips", "The plot's sales and checked sale slips, and the FPO's agreed rate card for deductions."),
    run: ({ season: s, plot, day }) => {
      const sales = s.eventsByPlot[plot].filter((e) => e.type === "sale" && e.day <= day + 60);
      const facts: Fact[] = sales.map((e) => eventFact(e, s));
      facts.push({ id: "card", source: "rules", text: `Agreed rate card: commission ${Math.round(COMMISSION * 100)}% of gross, hamali ₹${HAMALI_PER_CRATE} and weighment ₹${WEIGHMENT_PER_CRATE} a crate, freight at the run's rate` });
      return { data: sales.map((e) => describeEvent(e, s)), facts };
    },
  },

  transport: {
    spec: fn("transport", "The plot's bookings on pooled runs: run, collection point, market, departure and how full the vehicle is."),
    run: ({ season: s, plot, day }) => {
      const bookings = s.eventsByPlot[plot].filter((e): e is Extract<PlotEvent, { type: "booking" }> => e.type === "booking" && e.day >= day - 1).slice(0, 3);
      const facts: Fact[] = bookings.map((b) => {
        const r = s.runs.find((x) => x.id === b.run);
        return { id: b.id, source: "record" as const, text: `${describeEvent(b, s)}${r ? `; departs ${hh(r.departHour)}, ${r.crates} of ${r.capacity} crates` : ""}` };
      });
      if (!facts.length) facts.push({ id: "no-booking", source: "record", text: "No pooled-run booking yet; bookings open from crop stage a week before picking" });
      return { data: facts.map((f) => f.text), facts };
    },
  },

  export_check: {
    spec: fn("export_check", "Whether the next picking can go for export: copper sprays within the 60-day pre-harvest interval."),
    run: ({ season: s, plot, day }) => {
      const pick = s.eventsByPlot[plot].find((e) => e.type === "pick" && e.day >= day)?.day ?? s.plots[plot].harvestStart;
      const sprays = s.eventsByPlot[plot].filter((e): e is Extract<PlotEvent, { type: "spray" }> => e.type === "spray" && !e.washedOff && e.day <= pick && pick - e.day < EXPORT_PHI_DAYS);
      const clear = sprays.length ? Math.max(...sprays.map((e) => e.day)) + EXPORT_PHI_DAYS : null;
      const facts: Fact[] = [{ id: "export", source: "rules", text: sprays.length ? `Picking on ${fmtDay(pick)} is inside the ${EXPORT_PHI_DAYS}-day copper interval (${sprays.length} spray${sprays.length > 1 ? "s" : ""}); a picking from ${clear !== null && clear < SEASON_DAYS ? fmtDay(clear) : "after the season"} would clear it` : `Picking on ${fmtDay(pick)} clears the ${EXPORT_PHI_DAYS}-day copper interval` }];
      sprays.forEach((e) => facts.push(eventFact(e, s)));
      return { data: facts.map((f) => f.text), facts };
    },
  },

  search_knowledge: {
    spec: fn("search_knowledge", "Search the project's agronomy and model notes (blight, sprays, bahar, water, markets, slips) for background to explain an answer.", {
      query: { type: "string", description: "What to look up" },
    }, ["query"]),
    run: async (_ctx, a) => {
      const hits = await searchKb(String(a.query ?? ""), 3);
      return { data: hits.map((h) => ({ heading: h.heading, doc: h.doc, text: h.text.slice(0, 600) })), facts: hits.map((h) => ({ id: h.id, source: "knowledge" as const, text: `${h.heading} (${h.doc}): ${h.text.slice(0, 300)}` })) };
    },
  },
};

export const TOOL_SPECS = Object.values(TOOLS).map((t) => t.spec);

/** Evidence the router asks for up front, before the model plans its own calls. */
export const PREFETCH: Record<string, [string, Record<string, unknown>][]> = {
  spray_failed: [["plot_record", { kinds: ["spray"], days_back: 60 }], ["spray_window", {}]],
  next_spray: [["spray_window", {}], ["blight_status", {}], ["spray_rule", { kind: "preventive" }]],
  irrigation: [["irrigation_plan", {}], ["plot_profile", {}]],
  harvest_market: [["harvest_markets", {}], ["plot_profile", {}]],
  blight_risk: [["blight_status", {}], ["spray_window", {}]],
  sale_slip: [["sale_slips", {}]],
  transport: [["transport", {}], ["harvest_markets", {}]],
  weather: [["weather", { days_back: 1, days_ahead: 5 }]],
  export: [["export_check", {}], ["spray_rule", { kind: "curative" }]],
  other: [["plot_profile", {}]],
};

export async function runTool(name: string, ctx: ToolCtx, args: Record<string, unknown>): Promise<ToolResult> {
  const t = TOOLS[name];
  if (!t) return { data: { error: `no tool ${name}` }, facts: [] };
  try {
    return await t.run(ctx, args ?? {});
  } catch (err) {
    return { data: { error: String(err) }, facts: [] };
  }
}

