// Sign-in for test scripts: one session per (number, surface), cached in web/data/test-sessions.json
// (gitignored) and reused while the server still accepts it, so repeated runs stay inside the limit of
// three codes per number in ten minutes. Needs the on-screen code sink (the default without SMS).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "data", "test-sessions.json");

/** The demo's test numbers (see src/lib/server/seed.ts). */
export const PHONES = { sunita: "+919000000001", second: "+919000000002", officer: "+919000010001", admin: "+919000010002" };

const read = () => { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return {}; } };
const write = (j) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(j, null, 2)); };

/** A session token for this number on this surface ("phone" or "desk"), signing in only if needed. */
export async function sessionToken(base, phone, surface) {
  const cache = read();
  const key = `${base}|${phone}|${surface}`;
  const cookie = `kk_${surface}`;
  if (cache[key]) {
    const me = await fetch(`${base}/api/v1/auth/me`, { headers: { cookie: `${cookie}=${cache[key]}`, "X-KK-Surface": surface } }).then((r) => r.json()).catch(() => null);
    if (me?.person?.phone === phone) return cache[key];
  }
  const h = { "Content-Type": "application/json", "X-KK-Surface": surface };
  const otp = await fetch(`${base}/api/v1/auth/otp`, { method: "POST", headers: h, body: JSON.stringify({ phone }) }).then((r) => r.json());
  if (!otp.devCode) throw new Error(`no code for ${phone}: ${otp.error ?? "the server is not using the on-screen code sink"}`);
  const res = await fetch(`${base}/api/v1/auth/verify`, { method: "POST", headers: h, body: JSON.stringify({ phone, code: otp.devCode, device: "test script" }) });
  const token = /kk_(?:phone|desk)=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];
  if (!token) throw new Error(`sign-in failed for ${phone}: ${(await res.json().catch(() => ({}))).error ?? res.status}`);
  write({ ...cache, [key]: decodeURIComponent(token) });
  return decodeURIComponent(token);
}

/** Put a signed-in session for this number into a Puppeteer page's browser context. */
export async function signInPage(page, base, phone, surface) {
  const token = await sessionToken(base, phone, surface);
  await page.setCookie({ name: `kk_${surface}`, value: token, url: base, httpOnly: true, sameSite: "Lax" });
}

/** Headers for a signed-in API call from Node. */
export async function authHeaders(base, phone, surface) {
  return { cookie: `kk_${surface}=${await sessionToken(base, phone, surface)}`, "X-KK-Surface": surface, "Content-Type": "application/json" };
}
