// Two devices change the same plot at the same moment through the running server; both changes must
// survive, retries must be no-ops, and the hash chain must still verify. Usage: npx tsx scripts/lost-update-check.mts [baseUrl]
import { foldEvents, uuidv7, type SeasonEvent } from "../src/lib/events";

const BASE = process.argv[2] ?? "http://localhost:3000";
const now = Date.now();
const stamp = (dev: string) => `${now.toString(36).padStart(9, "0")}.0000.${dev}`;
const phone: SeasonEvent = { id: uuidv7(), hlc: stamp("phoneA"), by: "phoneA", v: 1, label: "check: phone logs a spray", kind: "entry", entry: { kind: "spray", plot: 84, day: 155, hour: 7, spray: "preventive" } };
const desk: SeasonEvent = { id: uuidv7(), hlc: stamp("deskB"), by: "deskB", v: 1, label: "check: desk sends an advisory", kind: "advisory", day: 155, hexes: [1, 2, 3] };
const other: SeasonEvent = { id: uuidv7(), hlc: stamp("phoneC"), by: "phoneC", v: 1, label: "check: another phone skips watering", kind: "entry", entry: { kind: "irrigate", plot: 84, day: 155, hour: 7, skipped: true } };

const post = (events: SeasonEvent[], from: string) =>
  fetch(`${BASE}/api/v1/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from, label: events[0].label, events }) }).then((r) => r.json() as Promise<{ results: { status: string }[] }>);

const [a, b, c] = await Promise.all([post([phone], "phoneA"), post([desk], "deskB"), post([other], "phoneC")]);
const retry = await Promise.all([post([phone], "phoneA"), post([desk, other], "deskB")]);
const all = (await fetch(`${BASE}/api/v1/events?after=0&limit=5000`).then((r) => r.json())) as { events: SeasonEvent[] };
const o = foldEvents(all.events);
const integrity = (await fetch(`${BASE}/api/v1/integrity`).then((r) => r.json())) as { ok: boolean; count: number };

const checks: [string, boolean][] = [
  ["three concurrent posts accepted", [a, b, c].every((x) => x.results[0].status === "accepted")],
  ["retries answered as duplicates", retry.flatMap((x) => x.results).every((r) => r.status === "duplicate")],
  ["the phone's spray survived", Boolean(o.entries?.some((e) => e.id === phone.id))],
  ["the other phone's skipped watering survived", Boolean(o.entries?.some((e) => e.id === other.id))],
  ["the desk's advisory survived", Boolean(o.advisories?.some((x) => x.day === 155 && x.hexes.join() === "1,2,3"))],
  ["each stored once", all.events.filter((e) => [phone.id, desk.id, other.id].includes(e.id)).length === 3],
  ["hash chain verifies", integrity.ok],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
