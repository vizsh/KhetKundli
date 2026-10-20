import { cellLabel, geo } from "@/lib/geo";
import { EXPORT_PHI_DAYS } from "@/lib/sim/rules";
import type { MarketId, PlotEvent, Provenance, Season } from "@/lib/sim/types";

/**
 * A lot passport: what a buyer may see about one picking, built only from the plot's record.
 * It names the village and the H3 cell, never the gat number or the farmer's full name.
 */

export const lotId = (plotId: string, picking: number) => `${plotId}-P${picking}`;

export function parseLotId(id: string): { plotId: string; picking: number } | null {
  const m = decodeURIComponent(id).toUpperCase().match(/^([A-Z]{3}-\d{3})-P([1-9])$/);
  return m ? { plotId: m[1], picking: Number(m[2]) } : null;
}

type Of<T extends PlotEvent["type"]> = Extract<PlotEvent, { type: T }>;

export type ExportCheck = {
  phi: number;
  /** The last copper spray before picking, if any falls inside the interval. */
  blocking?: { day: number; product: string; gap: number };
  /** First day a picking would clear the interval after the last spray. */
  clearsOn?: number;
  eligible: boolean;
};

export type Passport = {
  id: string;
  plot: number;
  plotId: string;
  village: string;
  villageMr: string;
  cell: string;
  grower: string;
  acres: number;
  drip: boolean;
  baharDay?: number;
  pick: { day: number; crates: number; grade: "A" | "B" | "C"; by: Provenance };
  run?: { id: string; hub: string; market: MarketId };
  sprays: { day: number; product: string; washedOff: boolean; by: Provenance }[];
  scans: { day: number; finding: string; by: Provenance }[];
  waterKl: number;
  savedKl: number;
  exportCheck: ExportCheck;
};

export function exportCheck(sprays: Passport["sprays"], pickDay: number): ExportCheck {
  // Washed-off sprays still left copper on the fruit: they count.
  const inside = sprays.filter((s) => s.day <= pickDay && pickDay - s.day < EXPORT_PHI_DAYS);
  const last = inside.at(-1);
  if (!last) return { phi: EXPORT_PHI_DAYS, eligible: true };
  return { phi: EXPORT_PHI_DAYS, eligible: false, blocking: { day: last.day, product: last.product, gap: pickDay - last.day }, clearsOn: last.day + EXPORT_PHI_DAYS };
}

export function passportFor(season: Season, id: string): Passport | null {
  const parsed = parseLotId(id);
  if (!parsed) return null;
  const plot = season.plots.findIndex((p) => p.id === parsed.plotId);
  if (plot < 0) return null;
  const p = season.plots[plot];
  const events = season.eventsByPlot[plot];
  const pick = events.find((e): e is Of<"pick"> => e.type === "pick" && e.picking === parsed.picking);
  if (!pick) return null;
  const booking = events.find((e): e is Of<"booking"> => e.type === "booking" && e.day === pick.day);
  const before = events.filter((e) => e.day <= pick.day);
  const sprays = before.filter((e): e is Of<"spray"> => e.type === "spray").map((e) => ({ day: e.day, product: e.product, washedOff: e.washedOff, by: e.by }));
  const village = geo.villages[p.village];
  const [first, ...rest] = p.farmer.name.split(" ");
  return {
    id: id.toUpperCase(),
    plot,
    plotId: p.id,
    village: village.name,
    villageMr: village.mr,
    cell: cellLabel(geo.hexes[p.hex].id),
    grower: `${first} ${rest.map((r) => `${r[0]}.`).join(" ")}`.trim(),
    acres: p.acres,
    drip: p.drip,
    baharDay: before.find((e) => e.type === "bahar")?.day,
    pick: { day: pick.day, crates: pick.crates, grade: pick.grade, by: pick.by },
    run: booking ? { id: booking.run, hub: geo.villages.find((v) => v.id === booking.hub)?.name ?? booking.hub, market: booking.market } : undefined,
    sprays,
    scans: before.filter((e): e is Of<"scan"> => e.type === "scan").map((e) => ({ day: e.day, finding: e.finding, by: e.by })),
    waterKl: Math.round(before.reduce((a, e) => a + (e.type === "irrigate" ? e.litres : 0), 0) / 1000),
    savedKl: Math.round(before.reduce((a, e) => a + (e.type === "irrigate-skip" ? e.litresSaved : 0), 0) / 1000),
    exportCheck: exportCheck(sprays, pick.day),
  };
}

/** Every picking of a plot, for the phone's list of lot passports. */
export function lotsOf(season: Season, plot: number) {
  return season.eventsByPlot[plot].filter((e): e is Of<"pick"> => e.type === "pick").map((e) => ({ id: lotId(season.plots[plot].id, e.picking), day: e.day, crates: e.crates, grade: e.grade, picking: e.picking }));
}
