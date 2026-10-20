import raw from "@/data/phaltan.json";
import type { LonLat } from "@/lib/sim/types";

export type Village = { id: string; name: string; mr: string; mrVerified: boolean; kind: string; at: LonLat; hub: string };
export type GeoLine = { kind: string; ref?: string; name?: string; pts: LonLat[] };
export type Hex = { id: string; center: LonLat; ring: LonLat[]; neighbors: number[]; village: number };
export type Route = { hub: string; to: string; km: number; onRoad: boolean; pts: LonLat[] };

export type TalukaGeo = {
  source: string;
  boundary: LonLat[];
  villages: Village[];
  hubs: string[];
  apmc: { id: string; name: string; mr: string; at: LonLat; approximate: boolean };
  roads: GeoLine[];
  rivers: GeoLine[];
  canals: GeoLine[];
  rail: GeoLine[];
  hexes: Hex[];
  routes: Route[];
};

export const geo = raw as unknown as TalukaGeo;

/** A short, readable H3 cell label: the index without its trailing padding (res-7 ids end in "ffffff"). */
export const cellLabel = (id: string) => id.replace(/f+$/, "").slice(-5).toUpperCase();

export const villageIndex = new Map(geo.villages.map((v, i) => [v.id, i]));
export const routeByHub = new Map(geo.routes.map((r) => [r.hub, r]));

export function kmBetween(a: LonLat, b: LonLat) {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Compass bearing in degrees from a to b (0 = north). */
export function bearing(a: LonLat, b: LonLat) {
  const toRad = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * toRad) * Math.cos(b[1] * toRad);
  const x =
    Math.cos(a[1] * toRad) * Math.sin(b[1] * toRad) -
    Math.sin(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.cos((b[0] - a[0]) * toRad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
