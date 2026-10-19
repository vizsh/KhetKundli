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

export type SyncMsg =
  | { kind: "hello"; from: string }
  | { kind: "state"; from: string; overrides: Overrides; inbox: Escalation[]; t?: number }
  | { kind: "overrides"; from: string; overrides: Overrides; label: string }
  | { kind: "time"; from: string; t: number }
  | { kind: "escalation"; from: string; item: Escalation }
  | { kind: "reply"; from: string; id: string; reply: NonNullable<Escalation["reply"]> }
  | { kind: "reset"; from: string };

/** This window's id, so a window ignores its own messages coming back from a relay. */
export const SELF = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

type Transport = (msg: SyncMsg) => void;
const transports = new Set<Transport>();

export function addTransport(t: Transport) {
  transports.add(t);
  return () => transports.delete(t);
}

/** Send to every other window and device this one is linked to. */
export function post(msg: SyncMsg) {
  for (const t of transports) t(msg);
}
