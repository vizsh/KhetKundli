// End-to-end checks of the backend through its HTTP API, with real sign-ins (the on-screen code sink):
// concurrent writes from three people all survive, retries are no-ops, every refusal that matters is a
// refusal, an advisory batch is sent once and only as prepared, and a backup restores the same.
// Usage: npx tsx scripts/api-check.mts [baseUrl]   (dev server running)
import { foldEvents, uuidv7, type SeasonEvent } from "../src/lib/events";
import { authHeaders, PHONES } from "./sessions.mjs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([name, ok, detail]);

const sunita = await authHeaders(BASE, PHONES.sunita, "phone");
const second = await authHeaders(BASE, PHONES.second, "phone");
const officer = await authHeaders(BASE, PHONES.officer, "desk");
const me = async (h: Record<string, string>) => (await fetch(`${BASE}/api/v1/auth/me`, { headers: h }).then((r) => r.json())).person as { id: string; plots: number[] };
const [sp, xp] = [(await me(sunita)).plots[0], (await me(second)).plots[0]];

const now = Date.now();
const stamp = (dev: string, n = 0) => `${(now + n).toString(36).padStart(9, "0")}.0000.${dev}`;
const post = (h: Record<string, string>, events: SeasonEvent[]) =>
  fetch(`${BASE}/api/v1/events`, { method: "POST", headers: h, body: JSON.stringify({ from: "api-check", label: "api-check", events }) }).then(async (r) => ({ status: r.status, ...(await r.json()) }) as { status: number; results: { status: string; reason?: string }[] });
const entry = (dev: string, plot: number, kind: "spray" | "irrigate"): SeasonEvent => ({
  id: uuidv7(), hlc: stamp(dev), by: dev, v: 1, label: "api-check", kind: "entry",
  entry: kind === "spray" ? { kind, plot, day: 155, hour: 7, spray: "preventive" } : { kind, plot, day: 155, hour: 7, skipped: true },
});

// 1 · Three people write at the same moment; nothing is lost, retries are duplicates.
const a = entry("phoneA", sp, "spray"), b = entry("phoneB", xp, "irrigate");
const c: SeasonEvent = { id: uuidv7(), hlc: stamp("deskC"), by: "deskC", v: 1, label: "api-check", kind: "advisory", day: 155, hexes: [7, 8] };
const first = await Promise.all([post(sunita, [a]), post(second, [b]), post(officer, [c])]);
check("three people write at once: all accepted", first.every((x) => x.results?.[0]?.status === "accepted"), first.map((x) => x.results?.[0]?.status).join(" "));
const retry = await Promise.all([post(sunita, [a]), post(second, [b]), post(officer, [c])]);
check("retries are duplicates, not new rows", retry.every((x) => x.results?.[0]?.status === "duplicate"));
const all = (await fetch(`${BASE}/api/v1/events?after=0&limit=5000`, { headers: officer }).then((r) => r.json())) as { events: SeasonEvent[] };
const o = foldEvents(all.events);
check("every change survived", Boolean(o.entries?.some((e) => e.id === a.id) && o.entries?.some((e) => e.id === b.id) && o.advisories?.some((x) => x.hexes.join() === "7,8")));

// 2 · Refusals.
const foreign = await post(sunita, [entry("phoneA", xp, "spray")]);
check("a farmer cannot write another farmer's plot", foreign.results?.[0]?.status === "rejected" && /not yours/.test(foreign.results[0].reason ?? ""), foreign.results?.[0]?.reason);
const undo: SeasonEvent = { id: uuidv7(), hlc: stamp("phoneA", 1), by: "phoneA", v: 1, label: "", kind: "retract", target: b.id };
const undone = await post(sunita, [undo]);
check("a farmer cannot undo someone else's entry", undone.results?.[0]?.status === "rejected", undone.results?.[0]?.reason);
const rain: SeasonEvent = { id: uuidv7(), hlc: stamp("phoneA", 2), by: "phoneA", v: 1, label: "", kind: "reset" };
check("a farmer cannot reset the season", (await post(sunita, [rain])).results?.[0]?.status === "rejected");
const statusOf = async (path: string, h: Record<string, string>, body?: unknown) => (await fetch(`${BASE}${path}`, { method: body ? "POST" : "GET", headers: h, body: body ? JSON.stringify(body) : undefined })).status;
check("a farmer cannot prepare or send advisories", (await statusOf("/api/agent/advisories", sunita, { day: 155 })) === 403 && (await statusOf("/api/messages", sunita, { batchId: "B1" })) === 403);
check("a farmer cannot read the status page or make backups", (await statusOf("/api/status", sunita)) === 403 && (await statusOf("/api/v1/admin/backup", sunita, {})) === 403);
check("a farmer cannot ask about another farmer's plot", (await statusOf("/api/agent/ask", sunita, { question: "When to spray?", plot: xp, useLlm: false })) === 403);
check("the old way of sending (text in the request) is refused", (await statusOf("/api/messages", officer, { items: [{ plot: sp, sms: "anything" }] })) === 400);

// 3 · An advisory batch is sent once, exactly as prepared, and only to the plots in it.
const batch = await fetch(`${BASE}/api/agent/advisories`, { method: "POST", headers: officer, body: JSON.stringify({ day: 155, selection: { by: "village", village: 9 } }) }).then((r) => r.json()) as { batchId: string | null; advisories: { plot: number; sms: string }[] };
if (batch.batchId) {
  const send = await fetch(`${BASE}/api/messages`, { method: "POST", headers: officer, body: JSON.stringify({ batchId: batch.batchId }) });
  const again = await fetch(`${BASE}/api/messages`, { method: "POST", headers: officer, body: JSON.stringify({ batchId: batch.batchId }) });
  check("a prepared batch is sent once; a second send is refused", send.status === 200 && again.status === 409, `${send.status} then ${again.status}`);
  const sent = (await fetch(`${BASE}/api/messages`, { headers: officer }).then((r) => r.json())).messages as { batch: string; plot: number; text: string }[];
  const mine = sent.filter((m) => m.batch === batch.batchId);
  check("what was sent is what was prepared", mine.length === batch.advisories.length && mine.every((m) => batch.advisories.some((x) => x.plot === m.plot && x.sms.slice(0, 160) === m.text)));
  const hers = (await fetch(`${BASE}/api/messages`, { headers: sunita }).then((r) => r.json())).messages as { plot: number }[];
  check("a farmer sees only messages to her own plot", hers.every((m) => m.plot === sp), `${hers.length} messages`);
} else check("village batch prepared", false, "no plots to warn in village 9");

// 4 · The hash chain verifies; a backup restores as the same record.
const integrity = (await fetch(`${BASE}/api/v1/integrity`, { headers: officer }).then((r) => r.json())) as { ok: boolean; count: number };
check("hash chain verifies", integrity.ok, `${integrity.count} events`);
const backup = (await fetch(`${BASE}/api/v1/admin/backup`, { method: "POST", headers: officer, body: "{}" }).then((r) => r.json())) as { drill?: { ok: boolean; checks: { name: string; ok: boolean }[] } };
check("backup and restore drill", Boolean(backup.drill?.ok), backup.drill?.checks.filter((x) => !x.ok).map((x) => x.name).join(", "));

// 5 · A lot passport needs no account and sees only its own plot.
const lot = await fetch(`${BASE}/api/sync?lot=TAR-214-P1`);
const reader = lot.body!.getReader();
const first8k = new TextDecoder().decode((await reader.read()).value);
await reader.cancel();
const state = JSON.parse(first8k.slice(first8k.indexOf("data: ") + 6, first8k.indexOf("\n\n"))) as { events: SeasonEvent[]; inbox: unknown[] };
check("a public lot page gets only its plot's record and no inbox", lot.status === 200 && !state.events.some((e) => e.kind === "entry" && e.entry.plot !== sp) && state.inbox.length === 0);

for (const [name, ok, detail] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ·  ${detail}` : ""}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
