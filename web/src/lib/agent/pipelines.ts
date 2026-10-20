import { fmtDay } from "@/lib/sim/calendar";
import { geo } from "@/lib/geo";
import { mrDay, mrNum } from "@/lib/farmer";
import { firstSprayWindow, SPRAYS } from "@/lib/sim/rules";
import type { Season } from "@/lib/sim/types";
import { guard } from "./guard";
import { runTool, type Fact } from "./tools";

/**
 * The daily advisory pipeline the desk runs each evening:
 *   select   plots in cells on warning or outbreak, or with blight scans within 5 km, not already symptomatic
 *   evidence blight status, the next sprayable morning and the preventive rule, per plot
 *   compose  a 160-character SMS in English and Marathi from reviewed templates (no model needed)
 *   guard    the same checks as Ask: doses from the table, dates in the evidence
 *   batch    grouped by village, with app or SMS as the channel
 */
export type Advisory = { plot: number; gat: number; village: string; channel: "app" | "sms"; sms: string; smsMr: string; window: string | null; facts: Fact[]; guardPassed: boolean };

export async function advisoryBatch(s: Season, day: number) {
  const t0 = performance.now();
  const selected = s.plots
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => s.hexRisk[day][p.hex] >= 2 && s.infected[day][i] < 2 && !s.eventsByPlot[i].some((e) => e.type === "spray" && !e.washedOff && e.day <= day && e.day > day - 10));
  const window = firstSprayWindow(s.weather, day + 1);
  const rule = SPRAYS.preventive;
  const out: Advisory[] = [];
  for (const { p, i } of selected) {
    const ctx = { season: s, plot: i, day };
    const facts = [...(await runTool("blight_status", ctx, {})).facts, ...(await runTool("spray_window", ctx, {})).facts, ...(await runTool("spray_rule", ctx, { kind: "preventive" })).facts];
    const v = geo.villages[p.village];
    const when = window === null ? "when a dry morning comes" : `${fmtDay(window)} 06:00`;
    const sms = `KhetKundli: blight near ${v.name}. Spray ${rule.product} ${when}, dry & calm. Gat ${p.gat}.`.slice(0, 160);
    const smsMr = `खेतकुंडली: ${v.mr} परिसरात तेल्या. ${window === null ? "कोरडी सकाळ मिळताच" : `${mrDay(window)} सकाळी ${mrNum(6)} वा.`} ${rule.mr} फवारा. गट ${mrNum(p.gat)}.`.slice(0, 160);
    out.push({ plot: i, gat: p.gat, village: v.name, channel: p.farmer.usesApp ? "app" : "sms", sms, smsMr, window: window === null ? null : when, facts, guardPassed: guard(sms, facts).passed });
  }
  const byVillage = Object.entries(out.reduce<Record<string, number>>((a, x) => ((a[x.village] = (a[x.village] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  return {
    day: fmtDay(day),
    plots: out.length,
    byChannel: { app: out.filter((x) => x.channel === "app").length, sms: out.filter((x) => x.channel === "sms").length },
    byVillage,
    guardPassed: out.every((x) => x.guardPassed),
    ms: Math.round(performance.now() - t0),
    advisories: out.slice(0, 60),
  };
}
