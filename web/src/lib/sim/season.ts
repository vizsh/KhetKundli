import { bearing, geo, kmBetween, routeByHub, villageIndex } from "@/lib/geo";
import { dayOf, fmtDay, SEASON_DAYS, weekOf } from "./calendar";
import { HERO_FARMER, makeFarmer } from "./people";
import { createRng, hash01 } from "./rng";
import {
  blightFavour,
  COMMISSION,
  CRATE_KG,
  firstSprayWindow,
  GRADE_FACTOR,
  HAMALI_PER_CRATE,
  KC,
  markets,
  SPRAYS,
  stageOn,
  VEHICLE,
  WEIGHMENT_PER_CRATE,
} from "./rules";
import type { MarketId, Overrides, Plot, PlotEvent, Provenance, Run, Season, WeatherDay } from "./types";
import { generateWeather, type LiveDaily } from "./weather";

export type SeasonInput = { seed?: number; overrides?: Overrides; live?: LiveDaily[] };

export const HERO_SPRAY_FAIL_DAY = 118;
const PICK_OFFSETS = [0, 8, 16, 25];
const PICK_SHARE = [0.2, 0.35, 0.3, 0.15];
const NEIGHBOUR_KM = 6;
const WARN_KM = 2.5;

type DraftEvent = Omit<PlotEvent, "id">;

export function generateSeason(input: SeasonInput = {}): Season {
  const seed = input.seed ?? 20261019;
  const ov = input.overrides ?? {};
  const rng = createRng(seed);

  // ---------------- weather ----------------
  const weather: WeatherDay[] = generateWeather(rng.fork(1));
  for (const l of input.live ?? []) {
    const [y, m, d] = l.date.split("-").map(Number);
    const day = dayOf(y, m - 1, d);
    if (day >= 0 && day < SEASON_DAYS) weather[day] = { ...l, day, live: true };
  }
  const recordedThrough = weather.reduce((last, w) => (w.observed ? w.day : last), -1);
  // The evening rain that washed off the hero's routine spray: the wettest recorded day in late
  // September when the real season is loaded, otherwise a scripted 14 mm on the default day.
  const wetEvening = weather.slice(108, 125).filter((w) => w.observed && w.rainMm >= 8);
  const heroSprayFailDay = wetEvening.length ? wetEvening.reduce((a, b) => (b.rainMm > a.rainMm ? b : a)).day : HERO_SPRAY_FAIL_DAY;
  if (!wetEvening.length) weather[HERO_SPRAY_FAIL_DAY] = { ...weather[HERO_SPRAY_FAIL_DAY], rainMm: 14.2, rainProb: 0.72, rh: 89, wetHours: undefined, observed: false };
  if (ov.rain && weather[ov.rain.day]) {
    const w = weather[ov.rain.day];
    // Rain wets the canopy for most of the day: without this, a live day's real (dry) wet hours would cancel the demo rain.
    weather[ov.rain.day] = { ...w, rainMm: ov.rain.mm, rainProb: 0.88, rh: Math.max(w.rh, 87), windKmh: Math.max(w.windKmh, 14), wetHours: Math.max(w.wetHours ?? 0, 14) };
  }

  // ---------------- plots ----------------
  const prng = rng.fork(2);
  const hexesByVillage = geo.villages.map(() => [] as number[]);
  geo.hexes.forEach((h, i) => hexesByVillage[h.village].push(i));
  const heroVillage = villageIndex.get("taradgaon") ?? 0;
  const plots: Plot[] = [];
  const usedGat = new Set<string>();

  geo.villages.forEach((v, vi) => {
    const hexes = hexesByVillage[vi];
    const count = v.kind === "town" ? 3 : Math.max(3, Math.round(hexes.length * 0.8));
    for (let k = 0; k < count; k++) {
      const isHero = vi === heroVillage && k === 0;
      const hex = hexes.length ? prng.pick(hexes) : nearestHex(v.at);
      const base = hexes.length ? geo.hexes[hex].center : v.at;
      let gat = isHero ? 214 : prng.int(101, 899);
      while (usedGat.has(`${vi}-${gat}`)) gat = prng.int(101, 899);
      usedGat.add(`${vi}-${gat}`);
      const acres = isHero ? 1.5 : Math.round(Math.min(3.5, Math.max(0.5, prng.normal(1.4, 0.6))) * 4) / 4;
      const baharStart = isHero ? 8 : prng.int(0, 24);
      const harvestStart = isHero ? 163 : baharStart + prng.int(150, 170);
      plots.push({
        id: `${v.id.slice(0, 3).toUpperCase()}-${gat}`,
        gat,
        village: vi,
        hex,
        at: isHero ? [base[0] + 0.002, base[1] - 0.0015] : [base[0] + prng.range(-0.006, 0.006), base[1] + prng.range(-0.005, 0.005)],
        acres,
        drip: isHero ? true : prng.chance(0.86),
        soil: isHero ? "medium black" : prng.pick(["medium black", "shallow murrum", "deep black"] as const),
        farmer: isHero ? HERO_FARMER : makeFarmer(prng),
        baharStart,
        harvestStart: harvestStart + (isHero ? (ov.heroPickShift ?? 0) : 0),
        expectedTonnes: Math.round(acres * (isHero ? 4.8 : prng.range(3.8, 5.4)) * 10) / 10,
      });
    }
  });
  const hero = plots.findIndex((p) => p.village === heroVillage && p.gat === 214);
  const n = plots.length;

  // ---------------- neighbourhoods ----------------
  const neigh = plots.map((p, i) =>
    plots
      .map((q, j) => ({ q: j, km: kmBetween(q.at, p.at), brg: bearing(q.at, p.at) }))
      .filter((x) => x.q !== i && x.km < NEIGHBOUR_KM)
      .map((x) => ({ ...x, w: Math.exp(-x.km / 1.4) })),
  );

  // ---------------- event log ----------------
  const drafts: DraftEvent[] = [];
  const log = (e: DraftEvent) => drafts.push(e);
  const say = (plot: number, day: number, hour: number, by: Provenance, rest: Record<string, unknown>) =>
    log({ plot, day, hour, by, ...rest } as DraftEvent);

  plots.forEach((p, i) =>
    say(i, p.baharStart, 7, "human", {
      type: "bahar",
      note: i === hero ? "Mrig bahar regulated; light pruning and defoliation done" : "Mrig bahar regulated",
    }),
  );

  // ---------------- blight spread ----------------
  const srng = rng.fork(3);
  const u = (plot: number, day: number, salt: number) => hash01(seed, plot, day, salt);
  const state = new Uint8Array(n); // 0 healthy, 1 latent, 2 symptomatic, 3 treated
  const latentLeft = new Int16Array(n);
  const detected = new Int16Array(n).fill(-1);
  const protectedUntil = new Int16Array(n).fill(-1);
  const infected: Uint8Array[] = [];
  const sprayQueue = new Map<number, { plot: number; kind: "curative" | "preventive"; reason: string }[]>();
  const queueSpray = (day: number, plot: number, kind: "curative" | "preventive", reason: string) => {
    const list = sprayQueue.get(day) ?? [];
    if (!list.some((s) => s.plot === plot)) list.push({ plot, kind, reason });
    sprayQueue.set(day, list);
  };
  const seeds = [46, 53, 58, 64, 71, 79].map((day) => ({ day, plot: srng.int(0, n - 1) })).filter((s) => s.plot !== hero);
  const scanOverrides = new Map<number, NonNullable<Overrides["scans"]>>();
  for (const s of ov.scans ?? []) scanOverrides.set(s.day, [...(scanOverrides.get(s.day) ?? []), s]);

  const detect = (p: number, day: number, confidence: number, offline: boolean, by: Provenance) => {
    say(p, day, by === "verified" ? 11 : 9, by, { type: "scan", finding: "bacterial-blight", confidence, offline });
    detected[p] = day;
    const window = firstSprayWindow(weather, day + 1) ?? day + 2;
    say(p, day, 9, "computed", {
      type: "advisory",
      text: `Bacterial blight on this plot. Spray ${SPRAYS.curative.product}, ${SPRAYS.curative.dose}, on ${fmtDay(window)} at 06:00 (first dry, calm morning).`,
    });
    queueSpray(window, p, "curative", "Blight confirmed by scan");
    const warned = neigh[p]
      .filter((x) => x.km < WARN_KM && plots[x.q].farmer.usesApp && state[x.q] !== 2 && x.q !== hero)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
    for (const x of warned) {
      const downwind = Math.cos(((x.brg - (weather[day].windFrom + 180)) * Math.PI) / 180) > 0.3;
      say(x.q, day, 10, "computed", {
        type: "advisory",
        text: `Blight confirmed ${x.km.toFixed(1)} km away${downwind ? ", upwind of you" : ""}. Preventive spray on ${fmtDay(window)} at 06:00.`,
      });
      if (u(x.q, day, 6) < 0.75) queueSpray(window, x.q, "preventive", "Neighbour warning from Pest Radar");
    }
  };

  for (let d = 0; d < SEASON_DAYS; d++) {
    const w = weather[d];
    const favour = blightFavour(w);
    const windTo = (w.windFrom + 180) % 360;

    for (let p = 0; p < n; p++) {
      if (state[p] === 1 && --latentLeft[p] <= 0) state[p] = 2;
    }
    for (const s of seeds) if (s.day === d && state[s.plot] === 0) { state[s.plot] = 1; latentLeft[s.plot] = 12; }
    if (d === 128 && state[hero] === 0) { state[hero] = 1; latentLeft[hero] = 11; }

    for (let p = 0; p < n; p++) {
      if (state[p] !== 0 || p === hero) continue;
      let pressure = 0;
      for (const x of neigh[p]) {
        const s = state[x.q];
        if (s !== 2 && s !== 3) continue;
        const align = Math.max(0, Math.cos(((x.brg - windTo) * Math.PI) / 180));
        pressure += x.w * (s === 2 ? 1 : 0.25) * (0.55 + 0.9 * align);
      }
      const shield = d <= protectedUntil[p] ? 0.35 : 1;
      const prob = 1 - Math.exp(-(0.0007 + 0.085 * pressure) * favour * shield);
      if (u(p, d, 1) < prob) { state[p] = 1; latentLeft[p] = 10 + Math.floor(u(p, d, 2) * 5); }
    }

    for (const s of scanOverrides.get(d) ?? []) {
      if (state[s.plot] === 2 || state[s.plot] === 1) {
        state[s.plot] = 2;
        detect(s.plot, d, s.confidence, s.offline, "human");
      } else {
        say(s.plot, d, 9, "human", { type: "scan", finding: "healthy", confidence: s.confidence, offline: s.offline });
      }
    }
    for (let p = 0; p < n; p++) {
      if (state[p] !== 2 || detected[p] >= 0 || p === hero) continue;
      const usesApp = plots[p].farmer.usesApp;
      if (u(p, d, 3) < (usesApp ? 0.28 : 0.06)) {
        detect(p, d, Math.round((0.72 + u(p, d, 4) * 0.24) * 100) / 100, u(p, d, 5) < 0.4, usesApp ? "human" : "verified");
      }
    }

    for (const a of (ov.advisories ?? []).filter((x) => x.day === d)) {
      const cells = new Set(a.hexes);
      const window = firstSprayWindow(weather, d) ?? d + 1;
      for (let p = 0; p < n; p++) {
        if (!cells.has(plots[p].hex) || state[p] === 2) continue;
        // App users get it on the phone; the rest by SMS from the FPO, and fewer of them act on it.
        const app = plots[p].farmer.usesApp;
        say(p, d, 8, "computed", { type: "advisory", text: `Officer advisory${app ? "" : " (SMS)"}: blight weather is forecast with wind from infected orchards. Preventive spray on ${fmtDay(window)} at 06:00.` });
        if (app || u(p, d, 7) < 0.45) queueSpray(window, p, "preventive", "Officer advisory from the 72-hour spread forecast");
      }
    }

    for (const job of sprayQueue.get(d) ?? []) {
      const washed = weather[d].rainMm >= 5;
      const spec = SPRAYS[job.kind];
      say(job.plot, d, 6, "human", { type: "spray", product: spec.product, dose: spec.dose, washedOff: washed, reason: job.reason });
      if (washed) {
        queueSpray(firstSprayWindow(weather, d + 1) ?? d + 2, job.plot, job.kind, "Repeat: previous spray washed off");
      } else if (job.kind === "curative" && state[job.plot] === 2) {
        state[job.plot] = 3;
      } else if (job.kind === "preventive") {
        protectedUntil[job.plot] = d + 10;
      }
    }
    infected.push(state.slice());
  }

  // Scripted hero history: the routine spray that rain washed off.
  say(hero, heroSprayFailDay, 15, "human", {
    type: "spray",
    product: SPRAYS.preventive.product,
    dose: SPRAYS.preventive.dose,
    washedOff: true,
    reason: `Routine spray, 4 hours before ${Math.round(weather[heroSprayFailDay].rainMm)} mm of evening rain`,
  });

  // ---------------- irrigation ----------------
  const waterSaved = new Float64Array(SEASON_DAYS);
  const faced = new Float64Array(SEASON_DAYS);
  const followed = new Float64Array(SEASON_DAYS);
  plots.forEach((p, i) => {
    const lastPick = p.harvestStart + PICK_OFFSETS[PICK_OFFSETS.length - 1];
    for (let d = p.baharStart + 20; d <= Math.min(lastPick, SEASON_DAYS - 2); d += 3) {
      const stage = stageOn(d, p.baharStart, p.harvestStart, lastPick);
      const et = weather[d].et0 + (weather[d - 1]?.et0 ?? 0) + (weather[d - 2]?.et0 ?? 0);
      const litres = Math.round(et * KC[stage] * p.acres * 4047 * 0.55);
      if (weather[d].rainMm >= 10 || (weather[d - 1]?.rainMm ?? 0) >= 10) continue;
      const rainNext = weather[d + 1].rainMm >= 5;
      if (rainNext) faced[d] += 1;
      if (rainNext && p.farmer.usesApp) {
        followed[d] += 1;
        waterSaved[d] += litres;
        say(i, d, 7, "human", { type: "irrigate-skip", litresSaved: litres, reason: `${weather[d + 1].rainMm.toFixed(0)} mm rain forecast tomorrow` });
      } else {
        say(i, d, 7, "human", { type: "irrigate", litres });
      }
    }
  });
  const waterSavedByDay: number[] = [];
  const forecastIrrigationShare: number[] = [];
  let cum = 0;
  for (let d = 0; d < SEASON_DAYS; d++) {
    cum += waterSaved[d];
    waterSavedByDay.push(Math.round(cum));
    let f = 0, s = 0;
    for (let k = Math.max(0, d - 20); k <= d; k++) { f += faced[k]; s += followed[k]; }
    forecastIrrigationShare.push(f ? s / f : 0);
  }

  // ---------------- markets ----------------
  const mrng = rng.fork(4);
  const BASE = [0, 0, 0, 0, 0, 112, 106, 101, 98, 96, 88, 76]; // ₹/kg grade A by month, Jun-Dec
  const JAN = 80;
  const prices: Record<MarketId, number[]> = { phaltan: [], pune: [], vashi: [] };
  const arrivals: Record<MarketId, number[]> = { phaltan: [], pune: [], vashi: [] };
  let noise = 0;
  for (let d = 0; d < SEASON_DAYS; d++) {
    const date = new Date(Date.UTC(2026, 5, 1 + d));
    const m = date.getUTCMonth();
    const base = m === 0 ? JAN : BASE[m];
    noise = noise * 0.8 + mrng.normal(0, 0.025);
    const hump = Math.exp(-(((d - 185) / 35) ** 2));
    const glut = Math.exp(-(((d - 168) / 4.5) ** 2));
    const aPh = 18 + 30 * hump;
    const aPu = 110 + 80 * hump + 150 * glut;
    const aVa = 240 + 90 * hump;
    arrivals.phaltan.push(Math.round(aPh));
    arrivals.pune.push(Math.round(aPu));
    arrivals.vashi.push(Math.round(aVa));
    const press = (a: number, normal: number) => Math.min(1.25, Math.max(0.55, 1 - 0.42 * (a / normal - 1)));
    prices.phaltan.push(Math.round(base * (1 + noise) * press(aPh, 18 + 30 * hump)));
    prices.pune.push(Math.round(base * 1.14 * (1 + noise * 1.2) * press(aPu, 110 + 80 * hump)));
    prices.vashi.push(Math.round(base * 1.24 * (1 + noise * 0.8) * press(aVa, 240 + 90 * hump)));
  }

  // ---------------- harvest, bookings, sales, runs ----------------
  const harvestByWeek: number[][] = Array.from({ length: weekOf(SEASON_DAYS) + 1 }, () => geo.villages.map(() => 0));
  const bookings: { plot: number; day: number; crates: number; market: MarketId; hub: string; grade: "A" | "B" | "C" }[] = [];
  plots.forEach((p, i) => {
    const hub = geo.villages[p.village].hub;
    const hubKm = routeByHub.get(hub)?.km ?? 15;
    const mk = markets(hubKm);
    const everInfected = infected[Math.min(SEASON_DAYS - 1, p.harvestStart)][i];
    const grade = everInfected === 2 ? "C" : everInfected === 3 ? "B" : "A";
    const loss = grade === "C" ? 0.6 : grade === "B" ? 0.88 : 1;
    PICK_OFFSETS.forEach((off, k) => {
      let day = p.harvestStart + off;
      if (day >= SEASON_DAYS - 1) return;
      const rainSoon = Math.max(weather[day].rainMm, weather[day + 1]?.rainMm ?? 0) >= 8;
      if (rainSoon) {
        const before = day - 1;
        say(i, before, 18, "computed", { type: "advisory", text: `Rain of 8 mm or more due around ${fmtDay(day)}. Pick on ${fmtDay(before)} to avoid fruit cracking.` });
        day = before;
      }
      const crates = Math.max(1, Math.round(((p.expectedTonnes * PICK_SHARE[k] * 1000) / CRATE_KG) * loss));
      say(i, day, 8, "human", { type: "pick", picking: k + 1, crates, grade });
      harvestByWeek[weekOf(day)][p.village] += crates;
      let market: MarketId = "phaltan";
      if (i === hero && ov.heroMarket) market = ov.heroMarket;
      else if (grade === "A") {
        const sale = Math.min(SEASON_DAYS - 1, day + 1);
        const net = (id: MarketId) => prices[id][sale] * CRATE_KG * (1 - COMMISSION) - mk[id].freightPerCrate;
        market = (["phaltan", "pune", "vashi"] as MarketId[]).reduce((a, b) => (net(b) > net(a) ? b : a));
      }
      bookings.push({ plot: i, day, crates, market, hub, grade });
    });
  });

  const runs: Run[] = [];
  const slips = ov.slips ?? [];
  const groups = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const k = `${b.day}|${b.hub}|${b.market}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  for (const [k, list] of groups) {
    const [dayStr, hub, market] = k.split("|");
    const day = Number(dayStr);
    const hubKm = routeByHub.get(hub)?.km ?? 15;
    const mk = markets(hubKm)[market as MarketId];
    let vehicle = 0;
    let current: Run | null = null;
    const newVehicle = (): Run => {
      vehicle += 1;
      const run: Run = {
        id: `R${day}-${hub.slice(0, 3).toUpperCase()}${market === "phaltan" ? "" : `-${market.slice(0, 2).toUpperCase()}`}-${vehicle}`,
        hub,
        day,
        departHour: market === "phaltan" ? 5.25 : market === "pune" ? 1.5 : 21,
        crates: 0,
        capacity: VEHICLE.capacity,
        vehicle: VEHICLE.name,
        plots: [],
        km: Math.round(mk.km * 10) / 10,
      };
      runs.push(run);
      return run;
    };
    // Fill vehicles in order; a lot larger than the space left is split across vehicles.
    for (const b of list.sort((a, c) => c.crates - a.crates)) {
      let remaining = b.crates;
      let firstRun = "";
      while (remaining > 0) {
        if (!current || current.crates >= VEHICLE.capacity) current = newVehicle();
        const take = Math.min(remaining, VEHICLE.capacity - current.crates);
        current.crates += take;
        if (!current.plots.includes(b.plot)) current.plots.push(b.plot);
        firstRun ||= current.id;
        remaining -= take;
      }
      say(b.plot, day, 19, "computed", { type: "booking", crates: b.crates, hub, run: firstRun, market: mk.id });
      const saleDay = Math.min(SEASON_DAYS - 1, day + 1);
      // A slip the farmer read on the phone is the sale as it happened; it replaces this one.
      if (slips.some((s) => s.plot === b.plot && Math.abs(s.day - saleDay) <= 3)) continue;
      const pricePerKg = Math.round(prices[mk.id][saleDay] * GRADE_FACTOR[b.grade]);
      const gross = b.crates * CRATE_KG * pricePerKg;
      const deductions = [
        { label: "Freight (pooled run)", amount: b.crates * mk.freightPerCrate },
        { label: "Commission 6%", amount: Math.round(gross * COMMISSION) },
        { label: "Hamali (loading)", amount: b.crates * HAMALI_PER_CRATE },
        { label: "Weighment", amount: b.crates * WEIGHMENT_PER_CRATE },
      ];
      say(b.plot, saleDay, 8, "verified", {
        type: "sale",
        crates: b.crates,
        market: mk.id,
        pricePerKg,
        gross,
        deductions,
        net: gross - deductions.reduce((s, x) => s + x.amount, 0),
      });
    }
  }
  for (const s of slips) {
    if (!plots[s.plot] || s.day < 0 || s.day >= SEASON_DAYS) continue;
    say(s.plot, s.day, 9, "human", {
      type: "sale",
      crates: s.crates,
      kg: s.kg,
      grade: s.grade,
      market: s.market,
      pricePerKg: s.pricePerKg,
      gross: s.gross,
      deductions: s.deductions,
      net: s.net,
      slip: { pattiNo: s.pattiNo, agent: s.agent, aboveCard: s.aboveCard, flags: s.flags },
    });
  }
  runs.sort((a, b) => a.day - b.day || a.departHour - b.departHour);
  const runsByDay: Run[][] = Array.from({ length: SEASON_DAYS }, () => []);
  for (const r of runs) runsByDay[r.day]?.push(r);

  // ---------------- assemble events ----------------
  const events = drafts
    .filter((e) => e.day >= 0 && e.day < SEASON_DAYS)
    .sort((a, b) => a.day - b.day || a.hour - b.hour || a.plot - b.plot)
    .map((e, i) => ({ ...e, id: `E${i}` }) as PlotEvent);
  const eventsByDay: PlotEvent[][] = Array.from({ length: SEASON_DAYS }, () => []);
  const eventsByPlot: PlotEvent[][] = plots.map(() => []);
  for (const e of events) { eventsByDay[e.day].push(e); eventsByPlot[e.plot].push(e); }

  // ---------------- Pest Radar: only what was reported ----------------
  const H = geo.hexes.length;
  const hexRisk: Uint8Array[] = [];
  const hexScore: Float32Array[] = [];
  const hexDetections: Uint8Array[] = [];
  const scansByDay = eventsByDay.map((list) => list.filter((e) => e.type === "scan" && e.finding === "bacterial-blight"));
  for (let d = 0; d < SEASON_DAYS; d++) {
    const own = new Float32Array(H);
    const count = new Uint8Array(H);
    for (let k = Math.max(0, d - 13); k <= d; k++) {
      const fresh = 1 - (d - k) / 14;
      for (const e of scansByDay[k]) {
        const h = plots[e.plot].hex;
        own[h] += fresh;
        count[h] = Math.min(255, count[h] + 1);
      }
    }
    const favour = blightFavour(weather[d]);
    const windTo = (weather[d].windFrom + 180) % 360;
    const score = new Float32Array(H);
    const risk = new Uint8Array(H);
    geo.hexes.forEach((h, i) => {
      let s = own[i];
      for (const j of h.neighbors) {
        if (!own[j]) continue;
        const align = Math.max(0, Math.cos(((bearing(geo.hexes[j].center, h.center) - windTo) * Math.PI) / 180));
        s += own[j] * (0.3 + 0.35 * align);
      }
      s *= 0.6 + 0.6 * favour;
      score[i] = s;
      risk[i] = s >= 1.2 ? 3 : s >= 0.55 ? 2 : s >= 0.16 ? 1 : 0;
    });
    hexRisk.push(risk);
    hexScore.push(score);
    hexDetections.push(count);
  }

  return {
    plots,
    weather,
    events,
    eventsByDay,
    eventsByPlot,
    hexRisk,
    hexScore,
    hexDetections,
    infected,
    harvestByWeek,
    prices,
    arrivals,
    runs,
    runsByDay,
    waterSavedByDay,
    forecastIrrigationShare,
    heroPlot: hero,
    heroSprayFailDay,
    recordedThrough,
  };
}

function nearestHex(at: [number, number]) {
  let best = 0, bestD = Infinity;
  geo.hexes.forEach((h, i) => { const d = kmBetween(at, h.center); if (d < bestD) { bestD = d; best = i; } });
  return best;
}
