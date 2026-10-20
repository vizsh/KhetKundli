import type { Overrides } from "@/lib/sim/types";

/** A farmer question handed to the extension officer, with the context it was asked in. */
export type Escalation = {
  id: string;
  plot: number;
  plotId: string;
  farmer: string;
  question: string;
  day: number;
  askedAt: string;
  context: string[];
  /** A slip dispute carries the sale slip's checks instead of a crop question. */
  topic?: "crop" | "slip";
  reply?: { text: string; by: string; at: string };
};

/** `hlc` stamps the durable messages (overrides, escalation, reply, reset) with a hybrid logical clock. */
export type SyncMsg = (
  | { kind: "hello"; from: string }
  | { kind: "state"; from: string; overrides: Overrides; inbox: Escalation[]; t?: number }
  | { kind: "overrides"; from: string; overrides: Overrides; label: string }
  | { kind: "time"; from: string; t: number }
  | { kind: "escalation"; from: string; item: Escalation }
  | { kind: "reply"; from: string; id: string; reply: NonNullable<Escalation["reply"]> }
  | { kind: "reset"; from: string }
) & { hlc?: string };

/** Messages that must arrive even if the device is offline when they are made: queued in the outbox. */
export const DURABLE = new Set<SyncMsg["kind"]>(["overrides", "escalation", "reply", "reset"]);

/** This window's id, so a window ignores its own messages coming back from a relay. */
export const SELF = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

/*
 * Hybrid logical clock: wall-clock milliseconds, a counter for events in the same millisecond (or when
 * a remote clock is ahead), and the window's id. Encoded so that plain string comparison is causal
 * order, which is what the relay and every screen use for last-writer-wins on the season's overrides.
 */
let clock = { ms: 0, c: 0 };
const pad = (n: number, w: number) => n.toString(36).padStart(w, "0");
const parse = (h: string) => {
  const [ms, c] = h.split(".");
  return { ms: parseInt(ms, 36), c: parseInt(c, 36) };
};

export function tick(): string {
  const now = Date.now();
  clock = now > clock.ms ? { ms: now, c: 0 } : { ms: clock.ms, c: clock.c + 1 };
  return `${pad(clock.ms, 9)}.${pad(clock.c, 4)}.${SELF}`;
}

/** Move this clock past a timestamp seen from another device, so the next local event sorts after it. */
export function observe(hlc: string | undefined) {
  if (!hlc) return;
  const r = parse(hlc);
  const now = Date.now();
  const ms = Math.max(now, r.ms, clock.ms);
  const c = ms === clock.ms && ms === r.ms ? Math.max(clock.c, r.c) + 1 : ms === clock.ms ? clock.c + 1 : ms === r.ms ? r.c + 1 : 0;
  clock = { ms, c };
}

/** The newest overrides this window has applied: anything older that arrives late is ignored. */
let applied = "";
export const isStale = (hlc: string | undefined) => Boolean(hlc) && hlc! <= applied;
export const noteApplied = (hlc: string | undefined) => {
  if (hlc && hlc > applied) applied = hlc;
};
export const appliedHlc = () => applied || undefined;

type Transport = (msg: SyncMsg) => void;
const transports = new Set<Transport>();

export function addTransport(t: Transport) {
  transports.add(t);
  return () => transports.delete(t);
}

/** Send to every other window and device this one is linked to. Durable messages get a clock stamp. */
export function post(msg: SyncMsg) {
  const stamped = DURABLE.has(msg.kind) && !msg.hlc ? { ...msg, hlc: tick() } : msg;
  if (stamped.kind === "overrides" || stamped.kind === "reset") noteApplied(stamped.hlc);
  for (const t of transports) t(stamped);
}
