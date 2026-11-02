import { z } from "zod";
import { SEASON_DAYS } from "@/lib/sim/calendar";
import type { FarmerEntry, MarketId, Overrides, SaleSlip } from "@/lib/sim/types";

/**
 * Season events: the facts every screen and the server agree on. A change to the season (a logged
 * spray, a scan, a slip, an officer's advisory, an undo) is one immutable event with its own id and a
 * hybrid-logical-clock stamp. The overrides the engine reads are a projection of the event set
 * (`foldEvents`), so devices merge by set union and can never overwrite each other's facts: the same
 * events, in any order and with any duplicates, give the same season everywhere.
 *
 * The schemas are the contract between the phone, the desk and the server; the server validates every
 * event against them before it is stored.
 */

export const SCHEMA_VERSION = 1;

const day = z.number().int().min(0).max(SEASON_DAYS - 1);
const plot = z.number().int().min(0).max(999);
const hour = z.number().int().min(0).max(23);
const money = z.number().finite().min(-1e8).max(1e8);
const grade = z.enum(["A", "B", "C"]);
const market = z.enum(["phaltan", "pune", "vashi"]);

/** Event ids are UUIDv7 strings made on the device, so a retry carries the same id. */
export const EventId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
/** `channel.ts` stamps: base-36 milliseconds, a counter, the window's id. String order is causal order. */
export const Hlc = z.string().regex(/^[0-9a-z]{9}\.[0-9a-z]{4}\.[0-9A-Za-z-]{1,40}$/);

const entry = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("spray"), plot, day, hour, spray: z.enum(["preventive", "curative"]) }),
  z.object({ kind: z.literal("irrigate"), plot, day, hour, skipped: z.boolean(), litres: z.number().int().min(0).max(1_000_000).optional() }),
  z.object({ kind: z.literal("pick"), plot, day, hour, crates: z.number().int().min(1).max(1000), grade }),
]);

const slip = z.object({
  id: z.string().min(1).max(64),
  plot,
  day,
  market,
  crates: z.number().int().min(0).max(5000),
  kg: z.number().min(0).max(200_000),
  grade,
  pricePerKg: z.number().min(0).max(10_000),
  gross: money,
  deductions: z.array(z.object({ label: z.string().max(80), amount: money, card: money.optional() })).max(20),
  net: money,
  pattiNo: z.string().max(40).optional(),
  agent: z.string().max(80).optional(),
  aboveCard: money,
  flags: z.array(z.string().max(200)).max(20),
});

const base = {
  id: EventId,
  hlc: Hlc,
  /** The device (window) that made it; an authenticated person once accounts exist. */
  by: z.string().min(1).max(40),
  v: z.literal(SCHEMA_VERSION),
  /** What other screens show as the ripple's heading. */
  label: z.string().max(200),
};

export const SeasonEvent = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("entry"), entry }),
  z.object({ ...base, kind: z.literal("scan"), plot, day, confidence: z.number().min(0).max(1), offline: z.boolean() }),
  z.object({ ...base, kind: z.literal("slip"), slip }),
  z.object({ ...base, kind: z.literal("advisory"), day, hexes: z.array(z.number().int().min(0).max(100_000)).max(400) }),
  z.object({ ...base, kind: z.literal("rain"), day, mm: z.number().min(0).max(300) }),
  z.object({ ...base, kind: z.literal("harvest"), shift: z.number().int().min(-30).max(30), market }),
  /** Undo: the target stops counting; it stays in the record. */
  z.object({ ...base, kind: z.literal("retract"), target: EventId }),
  /** The demo's reset: events before it stop counting; nothing is deleted. */
  z.object({ ...base, kind: z.literal("reset") }),
]);

export type SeasonEvent = z.infer<typeof SeasonEvent>;
export type SeasonEventKind = SeasonEvent["kind"];
type Payload<K extends SeasonEventKind> = Omit<Extract<SeasonEvent, { kind: K }>, keyof typeof base | "kind">;
export type EventDraft = { [K in SeasonEventKind]: { kind: K } & Payload<K> }[SeasonEventKind];

export const MAX_BATCH = 200;

/** Order every replica agrees on: clock stamp, then id. */
export const byClock = (a: SeasonEvent, b: SeasonEvent) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Union of two event sets by id; the result is sorted by clock. */
export function mergeEvents(a: readonly SeasonEvent[], b: readonly SeasonEvent[]): SeasonEvent[] {
  const seen = new Map<string, SeasonEvent>();
  for (const e of a) seen.set(e.id, e);
  for (const e of b) if (!seen.has(e.id)) seen.set(e.id, e);
  return [...seen.values()].sort(byClock);
}

/**
 * The overrides the engine reads, projected from the events. Pure and order-independent: events are
 * sorted by clock first, so where two facts compete for one slot (the same plot, day and kind of
 * entry; the same day's advisory; the harvest choice) the later clock wins on every replica.
 */
export function foldEvents(events: readonly SeasonEvent[]): Overrides {
  const sorted = mergeEvents([], events);
  let from = 0;
  sorted.forEach((e, i) => { if (e.kind === "reset") from = i + 1; });
  const live = sorted.slice(from);
  const retracted = new Set(live.flatMap((e) => (e.kind === "retract" ? [e.target] : [])));

  const entries = new Map<string, FarmerEntry>();
  const scans = new Map<string, NonNullable<Overrides["scans"]>[number]>();
  const slips = new Map<string, SaleSlip>();
  const advisories = new Map<number, number[]>();
  let rain: Overrides["rain"];
  let harvest: { shift: number; market: MarketId } | undefined;

  for (const e of live) {
    if (retracted.has(e.id)) continue;
    switch (e.kind) {
      case "entry": entries.set(`${e.entry.plot}|${e.entry.day}|${e.entry.kind}`, { ...e.entry, id: e.id } as FarmerEntry); break;
      case "scan": if (!scans.has(`${e.plot}|${e.day}`)) scans.set(`${e.plot}|${e.day}`, { plot: e.plot, day: e.day, confidence: e.confidence, offline: e.offline }); break;
      case "slip": slips.set(`${e.slip.plot}|${e.slip.day}`, e.slip); break;
      case "advisory": advisories.set(e.day, e.hexes); break;
      case "rain": rain = { day: e.day, mm: e.mm }; break;
      case "harvest": harvest = { shift: e.shift, market: e.market }; break;
    }
  }

  const out: Overrides = {};
  if (rain) out.rain = rain;
  if (scans.size) out.scans = [...scans.values()];
  if (harvest) { out.heroPickShift = harvest.shift; out.heroMarket = harvest.market; }
  if (slips.size) out.slips = [...slips.values()];
  if (advisories.size) out.advisories = [...advisories].map(([d, hexes]) => ({ day: d, hexes }));
  if (entries.size) out.entries = [...entries.values()];
  return out;
}

/** UUIDv7: 48 bits of milliseconds, then random bits. Works on plain-http origins, unlike randomUUID. */
export function uuidv7(now = Date.now()): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  for (let i = 0; i < 6; i++) b[i] = Math.floor(now / 2 ** (8 * (5 - i))) & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** JSON with keys sorted at every level: the same event always serialises to the same text. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}
