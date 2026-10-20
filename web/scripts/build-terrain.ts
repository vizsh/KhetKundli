// Fetches real elevation for Phaltan taluka from Open-Meteo's elevation API (Copernicus DEM, 90 m) and
// writes src/data/terrain.json: a regular grid for contour lines and the elevation of every H3 cell.
// Usage: npx tsx --tsconfig tsconfig.json scripts/build-terrain.ts
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geo } from "../src/lib/geo";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NX = 40, NY = 30;

async function elevations(points: [number, number][]) {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${batch.map((p) => p[1].toFixed(4)).join(",")}&longitude=${batch.map((p) => p[0].toFixed(4)).join(",")}`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url);
      if (res.ok) { out.push(...((await res.json()) as { elevation: number[] }).elevation); break; }
      // The free API limits requests per minute: wait the minute out, then carry on.
      if (attempt > 4) throw new Error(`elevation API ${res.status}`);
      console.log(`  rate limited, waiting (${attempt + 1})`);
      await new Promise((r) => setTimeout(r, 62_000));
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return out.map((z) => Math.round(z));
}

async function main() {
  const lons = geo.boundary.map((p) => p[0]), lats = geo.boundary.map((p) => p[1]);
  const pad = 0.01;
  const [x0, x1, y0, y1] = [Math.min(...lons) - pad, Math.max(...lons) + pad, Math.min(...lats) - pad, Math.max(...lats) + pad];
  const dlon = (x1 - x0) / (NX - 1), dlat = (y1 - y0) / (NY - 1);
  // Row-major from the north-west corner, as d3-contour expects (x across, y down).
  const grid: [number, number][] = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) grid.push([x0 + i * dlon, y1 - j * dlat]);
  const z = await elevations(grid);
  const hexElev = await elevations(geo.hexes.map((h) => h.center));
  const out = { source: "Open-Meteo elevation API (Copernicus DEM GLO-90)", grid: { west: x0, north: y1, dlon, dlat, nx: NX, ny: NY, z }, hexElev };
  writeFileSync(resolve(root, "src/data/terrain.json"), JSON.stringify(out));
  console.log(`terrain: ${z.length} grid points, ${hexElev.length} cells, ${Math.min(...z)}–${Math.max(...z)} m`);
}

void main();
