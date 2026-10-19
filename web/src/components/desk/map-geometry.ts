import { Delaunay } from "d3-delaunay";
import { geoArea, geoMercator, geoPath } from "d3-geo";
import type { Feature, Polygon } from "geojson";
import { geo } from "@/lib/geo";
import type { LonLat } from "@/lib/sim/types";

export const MAP_W = 900;
const PAD_X = 28, PAD_TOP = 84, PAD_BOTTOM = 44;

let ring = [...geo.boundary];
const asFeature = (r: LonLat[]): Feature<Polygon> => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [r] } });
// d3-geo treats a counter-clockwise exterior ring as "everything except this"; fix orientation.
if (geoArea(asFeature(ring)) > 2 * Math.PI) ring = ring.reverse();
const boundaryFeature = asFeature(ring);

// Fit the taluka to the sheet width, then size the sheet to the taluka (no empty bands).
const probe = geoMercator().fitWidth(MAP_W - PAD_X * 2, boundaryFeature);
const [[, py0], [, py1]] = geoPath(probe).bounds(boundaryFeature);
export const MAP_H = Math.round(py1 - py0) + PAD_TOP + PAD_BOTTOM;
export const projection = geoMercator().fitExtent([[PAD_X, PAD_TOP], [MAP_W - PAD_X, MAP_H - PAD_BOTTOM]], boundaryFeature);
const path = geoPath(projection).digits(1);
// Rounded so server and browser math engines produce identical markup.
export const project = (p: LonLat): [number, number] => {
  const [x, y] = projection(p) as [number, number];
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
};

const linePath = (pts: LonLat[]) => pts.map((p, i) => `${i ? "L" : "M"}${project(p).map((v) => v.toFixed(1)).join(",")}`).join("");

export const boundaryPath = path(boundaryFeature) ?? "";

export const roads = geo.roads.map((r) => ({ d: linePath(r.pts), major: r.kind === "trunk" || (r.ref ?? "").startsWith("NH"), ref: r.ref, name: r.name }));
export const rivers = geo.rivers.map((r) => ({ d: linePath(r.pts), name: r.name }));
export const canals = geo.canals.map((r) => ({ d: linePath(r.pts), name: r.name }));
export const rail = geo.rail.map((r) => ({ d: linePath(r.pts) }));

export const hexes = geo.hexes.map((h) => {
  const pts = h.ring.map(project);
  const c = project(h.center);
  return { d: `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L")}Z`, cx: c[0], cy: c[1] };
});

export const villages = geo.villages.map((v) => {
  const [x, y] = project(v.at);
  return { ...v, x, y };
});

const delaunay = Delaunay.from(villages.map((v) => [v.x, v.y]));
const voronoi = delaunay.voronoi([0, 0, MAP_W, MAP_H]);
export const fields = villages.map((_, i) => {
  const poly = voronoi.cellPolygon(i);
  return poly ? `M${poly.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L")}Z` : "";
});

// Greedy colouring so neighbouring village areas never share a tint.
const TINTS = ["var(--f-turmeric)", "var(--f-leaf)", "var(--f-canal)", "var(--f-aril)", "var(--f-lilac)"];
export const fieldTint: string[] = [];
villages.forEach((_, i) => {
  const used = new Set([...delaunay.neighbors(i)].filter((j) => j < i).map((j) => fieldTint[j]));
  fieldTint[i] = TINTS.find((t) => !used.has(t)) ?? TINTS[i % TINTS.length];
});

export const hubIds = geo.hubs;
const HUB_TINTS = ["#e7cf86", "#c3d9a6", "#b7d0df", "#e6bfb5", "#d0c5e3", "#dccf9e", "#a9cdb9", "#e4c79b", "#c9c2d6", "#bcd2c0"];
export const hubTint = new Map(hubIds.map((h, i) => [h, HUB_TINTS[i % HUB_TINTS.length]]));

export const apmc = (() => {
  const [x, y] = project(geo.apmc.at);
  return { ...geo.apmc, x, y };
})();

/** Projected route polylines with cumulative length, for placing vehicles by progress. */
export const routes = new Map(
  geo.routes.map((r) => {
    const pts = r.pts.map(project);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return [r.hub, { d: `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L")}`, pts, cum, km: r.km }] as const;
  }),
);

export function pointAlong(hub: string, frac: number) {
  const r = routes.get(hub);
  if (!r) return null;
  const target = Math.max(0, Math.min(1, frac)) * r.cum[r.cum.length - 1];
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < target) i++;
  const seg = r.cum[i] - r.cum[i - 1] || 1;
  const k = (target - r.cum[i - 1]) / seg;
  const a = r.pts[i - 1], b = r.pts[i];
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

/** Kilometres per projected unit, for the scale bar. */
export const kmPerUnit = (() => {
  const a = projection.invert!([MAP_W / 2, MAP_H / 2])!;
  const b = projection.invert!([MAP_W / 2 + 100, MAP_H / 2])!;
  const R = 6371, toRad = Math.PI / 180;
  const dLon = (b[0] - a[0]) * toRad;
  const km = 2 * R * Math.asin(Math.sqrt(Math.cos(a[1] * toRad) ** 2 * Math.sin(dLon / 2) ** 2));
  return km / 100;
})();

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Greedy label placement: towns first; each village tries eight positions with its Marathi line,
 * then eight without it, so a crowded label drops to English rather than overprinting a neighbour.
 */
type Placement = { dx: number; dy: number; anchor: "start" | "end" | "middle"; mr: boolean };
export const labelPlacement: Placement[] = (() => {
  const placed: Box[] = villages.map((v) => ({ x0: v.x - 4, y0: v.y - 4, x1: v.x + 4, y1: v.y + 4 }));
  const out: Placement[] = villages.map(() => ({ dx: 7, dy: -3, anchor: "start", mr: true }));
  const order = villages.map((v, i) => i).sort((a, b) => Number(villages[b].kind === "town") - Number(villages[a].kind === "town"));
  const candidates = (x: number, y: number, size: number, w: number, h: number) => [
    { dx: 7, dy: -3, anchor: "start" as const, box: { x0: x + 6, y0: y - size - 1, x1: x + 6 + w, y1: y - size - 1 + h } },
    { dx: -7, dy: -3, anchor: "end" as const, box: { x0: x - 6 - w, y0: y - size - 1, x1: x - 6, y1: y - size - 1 + h } },
    { dx: 0, dy: -h + size - 8, anchor: "middle" as const, box: { x0: x - w / 2, y0: y - h - 8, x1: x + w / 2, y1: y - 8 } },
    { dx: 0, dy: size + 6, anchor: "middle" as const, box: { x0: x - w / 2, y0: y + 6, x1: x + w / 2, y1: y + 6 + h } },
    { dx: 7, dy: size + 4, anchor: "start" as const, box: { x0: x + 6, y0: y + 4, x1: x + 6 + w, y1: y + 4 + h } },
    { dx: -7, dy: size + 4, anchor: "end" as const, box: { x0: x - 6 - w, y0: y + 4, x1: x - 6, y1: y + 4 + h } },
    { dx: 7, dy: -h + size - 6, anchor: "start" as const, box: { x0: x + 6, y0: y - h - 6, x1: x + 6 + w, y1: y - 6 } },
    { dx: -7, dy: -h + size - 6, anchor: "end" as const, box: { x0: x - 6 - w, y0: y - h - 6, x1: x - 6, y1: y - 6 } },
  ];
  for (const i of order) {
    const v = villages[i];
    const size = v.kind === "town" ? 15 : 12.5;
    const nameW = v.name.length * size * 0.6 + 6;
    const full = candidates(v.x, v.y, size, Math.max(nameW, v.mr.length * 12 * 0.65 + 6), size + 17).map((o) => ({ ...o, mr: true }));
    const bare = candidates(v.x, v.y, size, nameW, size + 3).map((o) => ({ ...o, mr: false }));
    const pick = [...full, ...bare].find((o) => !placed.some((b) => overlaps(b, o.box))) ?? bare[0];
    placed.push(pick.box);
    out[i] = { dx: pick.dx, dy: pick.dy, anchor: pick.anchor, mr: pick.mr };
  }
  return out;
})();
