import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { canonical, EventId, foldEvents, mergeEvents, SeasonEvent, uuidv7, type EventDraft, type SeasonEvent as Ev } from "@/lib/events";
import { generateSeason } from "@/lib/sim/season";

/*
 * The sync invariants, tested as properties: whatever subset, order and duplication of events each
 * device sees, once every device has seen every event they all fold to the same overrides. This is
 * what makes a lost update impossible.
 */

const T0 = Date.UTC(2026, 10, 3);
const hlcOf = (ms: number, c: number, dev: string) => `${ms.toString(36).padStart(9, "0")}.${c.toString(36).padStart(4, "0")}.${dev}`;
const idOf = (ms: number, rand: number) => {
  const h = (T0 + ms).toString(16).padStart(12, "0");
  const r = rand.toString(16).padStart(12, "0").slice(-12);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-7${r.slice(0, 3)}-8${r.slice(3, 6)}-${r.slice(0, 6)}${r.slice(6, 12)}`;
};

const draft: fc.Arbitrary<EventDraft> = fc.oneof(
  fc.record({ kind: fc.constant("entry" as const), entry: fc.oneof(
    fc.record({ kind: fc.constant("spray" as const), plot: fc.integer({ min: 0, max: 5 }), day: fc.integer({ min: 140, max: 150 }), hour: fc.constantFrom(7, 14, 18), spray: fc.constantFrom("preventive" as const, "curative" as const) }),
    fc.record({ kind: fc.constant("irrigate" as const), plot: fc.integer({ min: 0, max: 5 }), day: fc.integer({ min: 140, max: 150 }), hour: fc.constant(7), skipped: fc.boolean() }),
    fc.record({ kind: fc.constant("pick" as const), plot: fc.integer({ min: 0, max: 5 }), day: fc.integer({ min: 150, max: 170 }), hour: fc.constant(8), crates: fc.integer({ min: 1, max: 80 }), grade: fc.constantFrom("A" as const, "B" as const, "C" as const) }),
  ) }),
  fc.record({ kind: fc.constant("scan" as const), plot: fc.integer({ min: 0, max: 5 }), day: fc.integer({ min: 140, max: 150 }), confidence: fc.double({ min: 0.5, max: 1, noNaN: true }), offline: fc.boolean() }),
  fc.record({ kind: fc.constant("advisory" as const), day: fc.integer({ min: 140, max: 150 }), hexes: fc.array(fc.integer({ min: 0, max: 240 }), { maxLength: 5 }) }),
  fc.record({ kind: fc.constant("rain" as const), day: fc.integer({ min: 140, max: 150 }), mm: fc.integer({ min: 0, max: 40 }) }),
  fc.record({ kind: fc.constant("harvest" as const), shift: fc.integer({ min: -7, max: 7 }), market: fc.constantFrom("phaltan" as const, "pune" as const, "vashi" as const) }),
  fc.constant({ kind: "reset" as const }),
);

/** A history: events made on up to four devices, some of them undoing earlier ones. */
const history = fc
  .array(fc.record({ d: draft, ms: fc.integer({ min: 0, max: 1e6 }), dev: fc.constantFrom("dA", "dB", "dC", "dD"), rand: fc.integer({ min: 0, max: 2 ** 40 }), undo: fc.nat() }), { minLength: 1, maxLength: 30 })
  .map((xs) => {
    const out: Ev[] = [];
    xs.forEach((x, i) => {
      const base = { id: idOf(x.ms, x.rand + i), hlc: hlcOf(x.ms, i, x.dev), by: x.dev, v: 1 as const, label: "" };
      out.push({ ...base, ...x.d } as Ev);
      // Every fifth event undoes an earlier one.
      if (i % 5 === 4 && out.length > 1) out.push({ ...base, id: idOf(x.ms, x.rand + i + 7919), hlc: hlcOf(x.ms, i + 1000, x.dev), kind: "retract", target: out[x.undo % (out.length - 1)].id });
    });
    // Ids are unique by construction on real devices (UUIDv7); the server rejects a reused id.
    const seen = new Set<string>();
    return out.filter((e) => !seen.has(e.id) && seen.add(e.id));
  });

/** What a device saw: every event at least once (some twice), in its own order, in several batches. */
const deliveries = (events: Ev[]) =>
  fc.array(fc.tuple(fc.shuffledSubarray(events, { minLength: 0 }), fc.nat()), { minLength: 1, maxLength: 4 }).chain((extra) =>
    fc.shuffledSubarray([...events, ...extra.flatMap(([e]) => e)], { minLength: events.length + extra.flatMap(([e]) => e).length }).map((all) => {
      const batches: Ev[][] = [];
      let i = 0;
      for (const [, n] of extra) { const k = 1 + (n % 7); batches.push(all.slice(i, i + k)); i += k; }
      batches.push(all.slice(i));
      return batches;
    }),
  );

test("generated events satisfy the contract", () => {
  fc.assert(fc.property(history, (events) => events.every((e) => SeasonEvent.safeParse(e).success)), { numRuns: 300 });
});

test("convergence: any order, duplication and batching folds to the same overrides", () => {
  fc.assert(
    fc.property(history.chain((events) => fc.tuple(fc.constant(events), fc.array(deliveries(events), { minLength: 2, maxLength: 4 }))), ([events, devices]) => {
      const truth = canonical(foldEvents(events));
      for (const batches of devices) {
        let replica: Ev[] = [];
        for (const b of batches) replica = mergeEvents(replica, b);
        assert.equal(replica.length, new Set(events.map((e) => e.id)).size);
        assert.equal(canonical(foldEvents(replica)), truth);
      }
    }),
    { numRuns: 10_000 },
  );
});

test("merge is commutative, associative and idempotent", () => {
  fc.assert(
    fc.property(history, history, history, (a, b, c) => {
      const ids = (x: Ev[]) => x.map((e) => e.id).join();
      assert.equal(ids(mergeEvents(a, b)), ids(mergeEvents(b, a)));
      assert.equal(ids(mergeEvents(mergeEvents(a, b), c)), ids(mergeEvents(a, mergeEvents(b, c))));
      assert.equal(ids(mergeEvents(a, a)), ids(mergeEvents(a, [])));
    }),
    { numRuns: 2_000 },
  );
});

test("no lost update: two devices log different work at the same time, both survive", () => {
  const a: Ev = { id: uuidv7(T0), hlc: hlcOf(T0, 0, "phone"), by: "phone", v: 1, label: "", kind: "entry", entry: { kind: "spray", plot: 84, day: 155, hour: 7, spray: "curative" } };
  const b: Ev = { id: uuidv7(T0), hlc: hlcOf(T0, 0, "desk"), by: "desk", v: 1, label: "", kind: "entry", entry: { kind: "irrigate", plot: 84, day: 155, hour: 7, skipped: true } };
  for (const seen of [[a, b], [b, a]]) {
    const entries = foldEvents(mergeEvents([seen[0]], [seen[1]])).entries ?? [];
    assert.deepEqual(entries.map((e) => e.kind).sort(), ["irrigate", "spray"]);
  }
});

test("undo removes only its target, and a reset clears what came before it", () => {
  const e = (ms: number, extra: EventDraft): Ev => ({ id: uuidv7(T0 + ms), hlc: hlcOf(T0 + ms, 0, "d"), by: "d", v: 1, label: "", ...extra } as Ev);
  const spray = e(1, { kind: "entry", entry: { kind: "spray", plot: 1, day: 150, hour: 7, spray: "preventive" } });
  const scan = e(2, { kind: "scan", plot: 1, day: 150, confidence: 0.9, offline: true });
  const undo = e(3, { kind: "retract", target: spray.id });
  assert.deepEqual(foldEvents([spray, scan, undo]), { scans: [{ plot: 1, day: 150, confidence: 0.9, offline: true }] });
  assert.deepEqual(foldEvents([spray, scan, e(4, { kind: "reset" })]), {});
  assert.equal(foldEvents([spray, e(4, { kind: "reset" }), e(5, { kind: "rain", day: 150, mm: 18 })]).rain?.mm, 18);
});

test("the season is a function of the event set: same events in any order, same season", () => {
  fc.assert(
    fc.property(history, fc.nat(), (events, seed) => {
      const shuffled = [...events].sort((x, y) => ((x.id.charCodeAt(30) * 31 + seed) % 97) - ((y.id.charCodeAt(30) * 31 + seed) % 97));
      const summary = (evs: Ev[]) => {
        const s = generateSeason({ overrides: foldEvents(evs) });
        return canonical({ n: s.events.length, w: s.waterSavedByDay.at(-1), runs: s.runs.length, last: s.events.at(-1) });
      };
      assert.equal(summary(shuffled), summary(events));
    }),
    { numRuns: 12 },
  );
});

test("uuidv7 ids are valid, unique and time-ordered", () => {
  const ids = Array.from({ length: 2000 }, (_, i) => uuidv7(T0 + i));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => EventId.safeParse(id).success));
  assert.deepEqual([...ids].sort(), ids);
});
