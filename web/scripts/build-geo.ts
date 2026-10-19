// Turns raw OpenStreetMap extracts (data/raw) into the compact taluka geometry the app ships.
// Run: npx tsx scripts/build-geo.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { polygonToCells, cellToBoundary, cellToLatLng, gridDisk } from "h3-js";

type LonLat = [number, number];
type OsmGeomPt = { lat: number; lon: number };

const RAW = resolve(__dirname, "../../data/raw");
const OUT_DIR = resolve(__dirname, "../src/data");
const H3_RES = 7;

const read = (f: string) => JSON.parse(readFileSync(resolve(RAW, f), "utf8"));
const round = (n: number) => Math.round(n * 1e5) / 1e5;
const pt = (g: OsmGeomPt): LonLat => [round(g.lon), round(g.lat)];

// ---------- boundary: stitch outer member ways into closed rings ----------
function stitchRings(ways: LonLat[][]): LonLat[][] {
  const pool = ways.map((w) => [...w]);
  const rings: LonLat[][] = [];
  const same = (a: LonLat, b: LonLat) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  while (pool.length) {
    let ring = pool.shift()!;
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i];
        const end = ring[ring.length - 1];
        if (same(end, w[0])) ring = ring.concat(w.slice(1));
        else if (same(end, w[w.length - 1])) ring = ring.concat([...w].reverse().slice(1));
        else if (same(ring[0], w[w.length - 1])) ring = w.concat(ring.slice(1));
        else if (same(ring[0], w[0])) ring = [...w].reverse().concat(ring.slice(1));
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings.sort((a, b) => b.length - a.length);
}

// ---------- Douglas-Peucker ----------
function simplify(line: LonLat[], tol: number): LonLat[] {
  if (line.length < 3) return line;
  const sqTol = tol * tol;
  const segDist = (p: LonLat, a: LonLat, b: LonLat) => {
    let [x, y] = a;
    let dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let max = 0, idx = 0;
    for (let i = first + 1; i < last; i++) {
      const d = segDist(line[i], line[first], line[last]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > sqTol) { keep[idx] = 1; stack.push([first, idx], [idx, last]); }
  }
  return line.filter((_, i) => keep[i]);
}

function pointInRing(p: LonLat, ring: LonLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const kmBetween = (a: LonLat, b: LonLat) => {
  const R = 6371, toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

// ---------- load ----------
const boundaryRaw = read("boundary.json").elements[0];
const outerWays: LonLat[][] = boundaryRaw.members
  .filter((m: { role: string; type: string }) => m.type === "way" && m.role !== "inner")
  .map((m: { geometry: OsmGeomPt[] }) => m.geometry.map(pt));
const rings = stitchRings(outerWays);
const outer = rings[0];
const boundary = simplify(outer, 0.00025);
const inTaluka = (p: LonLat) => pointInRing(p, outer);
const nearTaluka = (p: LonLat) => {
  const lons = outer.map((q) => q[0]), lats = outer.map((q) => q[1]);
  return p[0] > Math.min(...lons) - 0.03 && p[0] < Math.max(...lons) + 0.03 && p[1] > Math.min(...lats) - 0.03 && p[1] < Math.max(...lats) + 0.03;
};

// Marathi names: best-effort transliteration, to be verified locally (flagged in output).
const MARATHI: Record<string, string> = {
  Phaltan: "फलटण", Lonand: "लोणंद", Nira: "नीरा", Adarki: "आदर्की", Mol: "मोळ", Late: "लाटे",
  "Ravadi BK": "रावडी बु.", Sakharwadi: "साखरवाडी", Phadtarwadi: "फडतरवाडी", Nandal: "नांदल",
  Pimprad: "पिंप्रद", Barad: "बरड", Vidni: "विडणी", Malegaon: "माळेगाव", Pandare: "पणदरे",
  Pawaimal: "पवईमाळ", Sharadanagar: "शारदानगर", Sangavi: "सांगवी", Taradgaon: "तरडगाव",
  Jinti: "जिंती", Nimbalak: "निंबळक", Girvi: "गिरवी", Nirugudi: "निरगुडी", Vinchurni: "विंचुर्णी",
  Mandhavkhadak: "मांढवखडक", Dalwadi: "दालवडी", Wakhari: "वाखरी", Tondale: "तोंडले",
  Saskal: "सासकल", Kamathwadi: "कामठवाडी", Diskal: "दिस्कळ", Jeur: "जेऊर", Kothale: "कोथळे",
  Kalaj: "काळज", Baramati: "बारामती",
};

// OSM spellings that are wrong in Marathi.
const CORRECTIONS: Record<string, string> = { Phaltan: "फलटण" };

type Village = { id: string; name: string; mr: string; mrVerified: boolean; kind: string; at: LonLat };
const seen = new Map<string, number>();
const villages: Village[] = read("places.json")
  .elements.filter((e: { tags: Record<string, string> }) => e.tags.name)
  .map((e: { lat: number; lon: number; tags: Record<string, string> }) => ({
    name: e.tags.name, osmMr: e.tags["name:mr"], kind: e.tags.place, at: [round(e.lon), round(e.lat)] as LonLat,
  }))
  .filter((v: { at: LonLat }) => inTaluka(v.at))
  .map((v: { name: string; osmMr?: string; kind: string; at: LonLat }) => {
    const n = (seen.get(v.name) ?? 0) + 1;
    seen.set(v.name, n);
    const slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: n > 1 ? `${slug}-${n}` : slug,
      name: n > 1 ? `${v.name} ${["", "", "II", "III"][n]}`.trim() : v.name,
      mr: CORRECTIONS[v.name] ?? v.osmMr ?? MARATHI[v.name] ?? v.name,
      mrVerified: Boolean(CORRECTIONS[v.name] ?? v.osmMr),
      kind: v.kind,
      at: v.at,
    };
  });

// ---------- linework ----------
type Line = { kind: string; ref?: string; name?: string; pts: LonLat[] };
const network = read("network.json").elements as { tags: Record<string, string>; geometry: OsmGeomPt[] }[];
const lines: Line[] = network
  .filter((w) => w.geometry?.length > 1)
  .map((w) => ({
    kind: w.tags.highway ?? w.tags.waterway ?? w.tags.railway,
    ref: w.tags.ref,
    name: w.tags.name,
    pts: w.geometry.map(pt),
  }))
  .filter((l) => l.pts.some(nearTaluka));
const simplified = (kind: string[], tol: number) =>
  lines.filter((l) => kind.includes(l.kind)).map((l) => ({ ...l, pts: simplify(l.pts, tol) }));
const roads = simplified(["trunk", "primary", "secondary"], 0.00018);
const rivers = simplified(["river"], 0.00015);
const canals = simplified(["canal"], 0.00015);
const rail = simplified(["rail"], 0.0002);

// ---------- H3 hexes ----------
const hexIds = polygonToCells([outer.map(([lon, lat]) => [lat, lon])], H3_RES);
const hexIndex = new Map(hexIds.map((id, i) => [id, i]));
const nearestVillage = (p: LonLat) => {
  let best = 0, bestD = Infinity;
  villages.forEach((v, i) => { const d = kmBetween(p, v.at); if (d < bestD) { bestD = d; best = i; } });
  return best;
};
const hexes = hexIds.map((id) => {
  const [lat, lon] = cellToLatLng(id);
  const center: LonLat = [round(lon), round(lat)];
  return {
    id,
    center,
    ring: cellToBoundary(id).map(([la, lo]) => [round(lo), round(la)] as LonLat),
    neighbors: gridDisk(id, 1).filter((n) => n !== id && hexIndex.has(n)).map((n) => hexIndex.get(n)!),
    village: nearestVillage(center),
  };
});

// ---------- road graph + routes ----------
// Nodes are rounded vertices; intersections share coordinates in OSM so they merge naturally.
const key = (p: LonLat) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
const nodes = new Map<string, LonLat>();
const adj = new Map<string, { to: string; km: number }[]>();
const link = (a: LonLat, b: LonLat) => {
  const ka = key(a), kb = key(b);
  if (ka === kb) return;
  nodes.set(ka, a); nodes.set(kb, b);
  const km = kmBetween(a, b);
  (adj.get(ka) ?? adj.set(ka, []).get(ka)!).push({ to: kb, km });
  (adj.get(kb) ?? adj.set(kb, []).get(kb)!).push({ to: ka, km });
};
lines.filter((l) => ["trunk", "primary", "secondary"].includes(l.kind)).forEach((l) => {
  for (let i = 1; i < l.pts.length; i++) link(l.pts[i - 1], l.pts[i]);
});
const nearestNode = (p: LonLat) => {
  let best = "", bestD = Infinity;
  nodes.forEach((q, k) => { const d = kmBetween(p, q); if (d < bestD) { bestD = d; best = k; } });
  return { key: best, km: bestD };
};
function dijkstra(from: string, to: string): string[] | null {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  const queue: [number, string][] = [[0, from]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift()!;
    if (done.has(u)) continue;
    done.add(u);
    if (u === to) break;
    for (const { to: v, km } of adj.get(u) ?? []) {
      const nd = d + km;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); queue.push([nd, v]); }
    }
  }
  if (!dist.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

const byName = (n: string) => villages.find((v) => v.name === n);
const phaltan = byName("Phaltan")!;
// Phaltan APMC sits in Phaltan town; exact yard coordinates are approximate.
const apmc = { id: "phaltan-apmc", name: "Phaltan APMC", mr: "फलटण बाजार समिती", at: phaltan.at, approximate: true };
const HUB_NAMES = ["Sakharwadi", "Taradgaon", "Adarki", "Girvi", "Barad", "Nandal", "Jinti", "Vidni", "Tondale", "Kalaj"];
const hubs = HUB_NAMES.map(byName).filter(Boolean) as Village[];

const apmcNode = nearestNode(apmc.at).key;
const routes = hubs.map((h) => {
  const start = nearestNode(h.at);
  const path = dijkstra(start.key, apmcNode);
  const pts: LonLat[] = [h.at, ...(path ?? []).map((k) => nodes.get(k)!), apmc.at];
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += kmBetween(pts[i - 1], pts[i]);
  return { hub: h.id, to: apmc.id, km: Math.round(km * 10) / 10, onRoad: Boolean(path), pts: simplify(pts, 0.0001) };
});

const villageHub = villages.map((v) => {
  let best = hubs[0], bestD = Infinity;
  hubs.forEach((h) => { const d = kmBetween(v.at, h.at); if (d < bestD) { bestD = d; best = h; } });
  return best.id;
});

const out = {
  source: "OpenStreetMap contributors (ODbL), extracted 2026-10-19; H3 resolution 7",
  boundary,
  villages: villages.map((v, i) => ({ ...v, hub: villageHub[i] })),
  hubs: hubs.map((h) => h.id),
  apmc,
  roads,
  rivers,
  canals,
  rail,
  hexes,
  routes,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "phaltan.json"), JSON.stringify(out));
console.log(
  `villages ${villages.length}, hexes ${hexes.length}, roads ${roads.length}, rivers ${rivers.length}, canals ${canals.length}, rail ${rail.length}, routes ${routes.length}`,
);
routes.forEach((r) => console.log(`  ${r.hub} -> APMC ${r.km} km ${r.onRoad ? "" : "(no road path)"}`));
console.log("unverified Marathi names:", villages.filter((v) => !v.mrVerified).length);
