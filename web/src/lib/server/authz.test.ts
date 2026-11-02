import { test } from "node:test";
import assert from "node:assert/strict";
import { uuidv7, type EventDraft, type SeasonEvent } from "@/lib/events";
import { can, canRecord, NOT_SIGNED_IN, type Action, type Actor } from "./authz";
import type { Role } from "./identity";

/*
 * The authorisation matrix: every role against every action, on her own plot and on someone else's.
 * The expected table is written out by hand, so a change to the policy has to change this file too.
 */

const OWN = 84, OTHER = 12, HERO = 84;
const actor = (role: Role, plots: number[] = []): Actor => ({ person: { id: `P-${role}`, phone: "+919000000000", name: role, nameMr: "", role, plots }, deviceId: "D1" });
const people: Record<string, Actor> = {
  nobody: null,
  farmer: actor("farmer", [OWN]),
  officer: actor("officer"),
  fpo_admin: actor("fpo_admin"),
  buyer: actor("buyer"),
};

// ✓ allowed · ✗ refused · columns: nobody, farmer (own plot), farmer (other plot), officer, fpo_admin, buyer
const MATRIX: Record<Action, string> = {
  "read-season":        "✗ ✓ ✓ ✓ ✓ ✗",
  "time":               "✗ ✓ ✓ ✓ ✓ ✗",
  "ask":                "✗ ✓ ✗ ✓ ✓ ✗",
  "escalate":           "✗ ✓ ✗ ✓ ✓ ✗",
  "receipt":            "✗ ✓ ✗ ✓ ✓ ✗",
  "reply":              "✗ ✗ ✗ ✓ ✓ ✗",
  "prepare-advisories": "✗ ✗ ✗ ✓ ✓ ✗",
  "send-advisories":    "✗ ✗ ✗ ✓ ✓ ✗",
  "read-messages-all":  "✗ ✗ ✗ ✓ ✓ ✗",
  "read-inbox-all":     "✗ ✗ ✗ ✓ ✓ ✗",
  "status":             "✗ ✗ ✗ ✓ ✓ ✗",
  "reset":              "✗ ✗ ✗ ✓ ✓ ✗",
  "backup":             "✗ ✗ ✗ ✓ ✓ ✗",
};

test("every role × every action, own plot and another's", () => {
  for (const [action, row] of Object.entries(MATRIX) as [Action, string][]) {
    const want = row.split(" ").map((c) => c === "✓");
    const got = [
      can(people.nobody, action, OWN),
      can(people.farmer, action, OWN),
      can(people.farmer, action, OTHER),
      can(people.officer, action, OTHER),
      can(people.fpo_admin, action, OTHER),
      can(people.buyer, action, OWN),
    ].map((r) => r === null);
    assert.deepEqual(got, want, `${action}: got ${got.map((x) => (x ? "✓" : "✗")).join(" ")}`);
  }
});

test("nobody signed in is told to sign in (a 401), not refused (a 403)", () => {
  for (const action of Object.keys(MATRIX) as Action[]) assert.equal(can(null, action, OWN), NOT_SIGNED_IN);
});

const ev = (d: EventDraft): SeasonEvent => ({ id: uuidv7(), hlc: "0000000aa.0000.dev", by: "dev", v: 1, label: "", ...d } as SeasonEvent);
const KINDS: [string, SeasonEvent, { targetAuthor?: string | null }][] = [
  ["entry, own plot", ev({ kind: "entry", entry: { kind: "spray", plot: OWN, day: 150, hour: 7, spray: "preventive" } }), {}],
  ["entry, other plot", ev({ kind: "entry", entry: { kind: "spray", plot: OTHER, day: 150, hour: 7, spray: "preventive" } }), {}],
  ["scan, other plot", ev({ kind: "scan", plot: OTHER, day: 150, confidence: 0.9, offline: true }), {}],
  ["slip, other plot", ev({ kind: "slip", slip: { id: "s", plot: OTHER, day: 160, market: "pune", crates: 1, kg: 20, grade: "A", pricePerKg: 90, gross: 1800, deductions: [], net: 1800, aboveCard: 0, flags: [] } }), {}],
  ["harvest choice (hero plot)", ev({ kind: "harvest", shift: -2, market: "pune" }), {}],
  ["advisory", ev({ kind: "advisory", day: 150, hexes: [1] }), {}],
  ["demo rain", ev({ kind: "rain", day: 150, mm: 18 }), {}],
  ["reset", ev({ kind: "reset" }), {}],
  ["undo own event", ev({ kind: "retract", target: uuidv7() }), { targetAuthor: "P-farmer" }],
  ["undo someone else's", ev({ kind: "retract", target: uuidv7() }), { targetAuthor: "P-other" }],
  ["undo a missing event", ev({ kind: "retract", target: uuidv7() }), {}],
];
// columns: nobody, farmer (owns 84 = hero), officer, fpo_admin, buyer
const RECORD: Record<string, string> = {
  "entry, own plot":            "✗ ✓ ✓ ✓ ✗",
  "entry, other plot":          "✗ ✗ ✓ ✓ ✗",
  "scan, other plot":           "✗ ✗ ✓ ✓ ✗",
  "slip, other plot":           "✗ ✗ ✓ ✓ ✗",
  "harvest choice (hero plot)": "✗ ✓ ✓ ✓ ✗",
  "advisory":                   "✗ ✗ ✓ ✓ ✗",
  "demo rain":                  "✗ ✗ ✓ ✓ ✗",
  "reset":                      "✗ ✗ ✓ ✓ ✗",
  "undo own event":             "✗ ✓ ✓ ✓ ✗",
  "undo someone else's":        "✗ ✗ ✓ ✓ ✗",
  "undo a missing event":       "✗ ✗ ✗ ✗ ✗",
};

test("who may record which season event", () => {
  for (const [name, e, ctx] of KINDS) {
    const want = RECORD[name].split(" ").map((c) => c === "✓");
    const got = [people.nobody, people.farmer, people.officer, people.fpo_admin, people.buyer].map((a) => canRecord(a, e, { heroPlot: HERO, ...ctx }) === null);
    assert.deepEqual(got, want, `${name}: got ${got.map((x) => (x ? "✓" : "✗")).join(" ")}`);
  }
});

test("a farmer who is not the hero cannot change the hero's picking date", () => {
  assert.notEqual(canRecord(actor("farmer", [OTHER]), ev({ kind: "harvest", shift: 1, market: "pune" }), { heroPlot: HERO }), null);
});
