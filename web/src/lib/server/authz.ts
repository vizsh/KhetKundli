import type { SeasonEvent } from "@/lib/events";
import type { Person, Role } from "./identity";

/**
 * Who may do what. Pure functions over the signed-in person, so the whole policy is tested as a
 * matrix (authz.test.ts). Each check returns null when allowed, or the reason it is refused; route
 * handlers turn a reason into 401 (not signed in) or 403 (signed in, not allowed).
 *
 * - A farmer writes only her own plots' record (entries, scans, slips, undo of her own events), asks
 *   about her own plot, escalates about it, and acknowledges messages sent to it.
 * - An officer or FPO admin sends advisories, replies, uses the demo controls (rain, reset) and sees
 *   every plot's inbox and messages. Resets and backups are for the FPO admin and the officer.
 * - A buyer has no write rights; lot passports are public by lot number.
 *
 * Reading the raw season events is open to any signed-in person for now, because the season is still
 * computed on each screen. Server-computed projections with consent filters replace that (GAPS G-B2, G-B5).
 */

export type Actor = { person: Person; deviceId: string } | null;
export type Action =
  | "read-season"
  | "ask"
  | "escalate"
  | "reply"
  | "prepare-advisories"
  | "send-advisories"
  | "receipt"
  | "read-messages-all"
  | "read-inbox-all"
  | "status"
  | "reset"
  | "backup"
  | "time";

const STAFF: Role[] = ["officer", "fpo_admin"];
const isStaff = (a: Actor) => Boolean(a && STAFF.includes(a.person.role));
const owns = (a: Actor, plot: number) => Boolean(a && a.person.plots.includes(plot));

export const NOT_SIGNED_IN = "Sign in first.";

/** A general check; `plot` is the plot the action is about, where there is one. */
export function can(a: Actor, action: Action, plot?: number): string | null {
  if (!a) return NOT_SIGNED_IN;
  const role = a.person.role;
  switch (action) {
    case "read-season":
    case "time":
      return role === "buyer" ? "Buyers see lot passports, not the season." : null;
    case "ask":
    case "escalate":
      if (isStaff(a)) return null;
      return role === "farmer" && plot !== undefined && owns(a, plot) ? null : "You can ask only about your own plot.";
    case "receipt":
      return isStaff(a) || (plot !== undefined && owns(a, plot)) ? null : "This message was not sent to your plot.";
    case "reply":
    case "prepare-advisories":
    case "send-advisories":
    case "read-messages-all":
    case "read-inbox-all":
    case "status":
      return isStaff(a) ? null : "Only the extension officer or the FPO can do this.";
    case "reset":
    case "backup":
      return isStaff(a) ? null : "Only the FPO admin or the officer can do this.";
  }
}

/** The plot a season event is about, if it is about one. */
export function plotOf(e: SeasonEvent): number | null {
  switch (e.kind) {
    case "entry": return e.entry.plot;
    case "scan": return e.plot;
    case "slip": return e.slip.plot;
    default: return null;
  }
}

/**
 * May this person record this season event? `heroPlot` is the plot the demo's harvest choice belongs
 * to; `targetAuthor` is, for an undo, the person who recorded the event being undone.
 */
export function canRecord(a: Actor, e: SeasonEvent, ctx: { heroPlot: number; targetAuthor?: string | null }): string | null {
  if (!a) return NOT_SIGNED_IN;
  const role = a.person.role;
  if (role === "buyer") return "Buyers cannot change a season record.";
  switch (e.kind) {
    case "entry":
    case "scan":
    case "slip": {
      const plot = plotOf(e)!;
      return owns(a, plot) || isStaff(a) ? null : `Plot ${plot} is not yours.`;
    }
    case "harvest":
      return owns(a, ctx.heroPlot) || isStaff(a) ? null : "The picking date belongs to the plot's farmer.";
    case "advisory":
    case "rain":
    case "reset":
      return isStaff(a) ? null : "Only the extension officer or the FPO can do this.";
    case "retract":
      if (ctx.targetAuthor === undefined) return "Nothing to undo with that id.";
      return ctx.targetAuthor === a.person.id || isStaff(a) ? null : "You can undo only what you recorded.";
  }
}
