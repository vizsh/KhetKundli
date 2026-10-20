// One command for the local demo: checks the local models, the database and the saved forecast,
// warms everything, starts the app for the laptop and the phones on the same Wi-Fi, and prints where to go.
//
//   npm run demo                      http on this laptop and the Wi-Fi
//   npm run demo -- --https           HTTPS on the Wi-Fi (phone camera and microphone); self-signed, no system changes
//   npm run demo -- --offline         no internet: weather, wind and ensemble from the last saved forecast
//   options: --port 3000  --no-open
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import QRCode from "qrcode";
import { ensureCertificate, lanAddresses } from "./cert.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const PORT = Number(args[args.indexOf("--port") + 1]) || 3000;
const HTTPS = flag("--https");
const OFFLINE = flag("--offline");
const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODELS = [process.env.AGENT_MODEL ?? "llama3.1:8b", process.env.EMBED_MODEL ?? "nomic-embed-text"];
const DB = resolve(import.meta.dirname, "..", "data", "khetkundli.db");
const scheme = HTTPS ? "https" : "http";
if (HTTPS) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // this script's own warm-up calls to the local self-signed server only

const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const warn = (s) => console.log(`  \x1b[33m!\x1b[0m ${s}`);
const fail = (s) => { console.log(`  \x1b[31m✗\x1b[0m ${s}`); process.exit(1); };
const ms = async (fn) => { const t = performance.now(); const r = await fn(); return [r, Math.round(performance.now() - t)]; };

console.log(`\n  KhetKundli · local demo${HTTPS ? " · HTTPS" : ""}${OFFLINE ? " · OFFLINE" : ""}\n`);

// 1. Local models.
async function tags() {
  try { return (await (await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(2500) })).json()).models.map((m) => m.name); } catch { return null; }
}
let have = await tags();
if (!have) {
  warn("Ollama is not running; starting it");
  spawn("ollama", ["serve"], { detached: true, stdio: "ignore", shell: true }).unref();
  for (let i = 0; i < 20 && !have; i++) { await new Promise((r) => setTimeout(r, 750)); have = await tags(); }
}
if (!have) warn("Ollama did not start: the agent will answer from the rules only. Install it from ollama.com or run `ollama serve`.");
else {
  const missing = MODELS.filter((m) => !have.some((h) => h === m || h.startsWith(`${m}:`)));
  if (missing.length) warn(`missing models: ${missing.map((m) => `ollama pull ${m}`).join("  ·  ")}`);
  else {
    const [, chat] = await ms(() => fetch(`${OLLAMA}/api/chat`, { method: "POST", body: JSON.stringify({ model: MODELS[0], messages: [{ role: "user", content: "Reply OK." }], stream: false, keep_alive: "60m", options: { num_predict: 1 } }) }).then((r) => r.json()));
    const [, emb] = await ms(() => fetch(`${OLLAMA}/api/embed`, { method: "POST", body: JSON.stringify({ model: MODELS[1], input: ["warm up"], keep_alive: "60m" }) }).then((r) => r.json()));
    ok(`models loaded on the GPU: ${MODELS[0]} (${chat} ms), ${MODELS[1]} (${emb} ms)`);
  }
}

// 2. Database and the saved forecast.
if (existsSync(DB)) {
  const d = new DatabaseSync(DB, { readOnly: true });
  const n = (q) => Number(d.prepare(q).get().n);
  const snaps = d.prepare("select name, fetched_at from snapshots").all();
  ok(`database: ${n("select count(*) as n from events")} events, ${n("select count(*) as n from messages")} messages, ${n("select count(*) as n from agent_log")} agent answers`);
  if (snaps.length) ok(`saved forecast: ${snaps.map((s) => `${s.name} ${new Date(s.fetched_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}`).join(", ")}`);
  else if (OFFLINE) fail("offline mode needs a saved forecast: run `npm run demo` once with the network first");
  else warn("no saved forecast yet: it is saved automatically the first time the weather loads");
  d.close();
} else if (OFFLINE) fail("offline mode needs a saved forecast: run `npm run demo` once with the network first");
else warn("no database yet: it is created on first start");

// 3. Certificate for the phones.
let tls = [];
if (HTTPS) {
  const c = ensureCertificate();
  ok(`certificate for ${c.ips.join(", ")} ${c.created ? "(new)" : ""}`);
  tls = ["--experimental-https", "--experimental-https-key", c.key, "--experimental-https-cert", c.cert];
}

// 4. The app.
const env = { ...process.env, KHETKUNDLI_OFFLINE: OFFLINE ? "1" : "0", NEXT_TELEMETRY_DISABLED: "1" };
delete env.NODE_TLS_REJECT_UNAUTHORIZED;
const next = spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", String(PORT), ...tls], { env, shell: true, cwd: resolve(import.meta.dirname, "..") });
let ready = false;
const pipe = (buf) => {
  for (const line of String(buf).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/Another next dev server is already running/.test(line)) next.kill(), fail("another KhetKundli dev server is already running in this folder: stop it (Ctrl+C in its terminal) and run the demo again");
    if (/error|warn|khetkundli/i.test(line) || !ready) console.log(`    next │ ${line}`);
  }
};
// Ready means the app answers, not that Next printed "Ready" (it prints that before some start-up checks).
void (async () => {
  for (let i = 0; i < 120 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${scheme}://localhost:${PORT}/api/status`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
    if (res?.ok) { ready = true; await afterReady(); }
  }
  if (!ready) { next.kill(); fail("the app did not answer within two minutes; see the lines above"); }
})();
next.stdout.on("data", pipe);
next.stderr.on("data", pipe);
next.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => { next.kill("SIGINT"); process.exit(0); });

async function afterReady() {
  const base = `${scheme}://localhost:${PORT}`;
  const [w, wMs] = await ms(() => fetch(`${base}/api/weather`).then((r) => r.json()).catch((e) => ({ error: String(e) })));
  if (w?.status === "live") ok(`weather: ${w.snapshotAt ? `saved forecast from ${w.snapshotAt}` : "live from Open-Meteo"} (${wMs} ms)`);
  else warn(`weather unavailable (${w?.error ?? "no data"}): the season runs on synthetic weather`);
  const [a, aMs] = await ms(() => fetch(`${base}/api/agent/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "When should I spray next?", day: 140 }) }).then((r) => r.text()).catch(() => null));
  const engine = a?.match(/"engine":"(\w+)"/)?.[1];
  if (engine) ok(`agent warmed end to end: ${engine === "llm" ? "local model" : "rules fallback"} (${(aMs / 1000).toFixed(1)} s)`);
  else warn("the agent did not answer the warm-up question; Ask still answers from the phone's record");
  const ip = lanAddresses()[0];
  const phone = ip ? `${scheme}://${ip}:${PORT}/farmer` : null;
  console.log(`\n  Desk     ${base}/desk`);
  console.log(`  Pitch    ${base}/`);
  if (phone) console.log(`  Phone    ${phone}   (same Wi-Fi)`);
  console.log(`  Status   ${base}/status\n`);
  if (phone) console.log((await QRCode.toString(phone, { type: "terminal", small: true })).replace(/^/gm, "  "));
  if (HTTPS) console.log("  On the phone, accept the certificate warning once (Advanced → Proceed); it is this laptop's own certificate.\n");
  if (!flag("--no-open")) spawnSync(process.platform === "win32" ? "cmd" : "open", process.platform === "win32" ? ["/c", "start", "", `${base}/desk`] : [`${base}/desk`]);
  console.log("  Ctrl+C stops the demo.\n");
}
