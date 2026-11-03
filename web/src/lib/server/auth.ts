import type { Actor } from "./authz";
import { NOT_SIGNED_IN } from "./authz";
import { SESSION_TTL_MS } from "./identity";
import { identity } from "./seed";

/**
 * Sessions are per surface: the farmer's phone (`/farmer`) and the officer's desk (`/desk`, `/status`)
 * each keep their own http-only cookie, so the desk can open Sunita's phone in a popup in the same
 * browser and both stay signed in as different people. A request names its surface with the
 * `X-KK-Surface` header (or `?surface=` on the event stream); without one, the desk's session is used,
 * then the phone's.
 */
export type Surface = "phone" | "desk";
export const cookieName = (s: Surface) => `kk_${s}`;

export function surfaceOf(req: Request): Surface | null {
  const v = req.headers.get("x-kk-surface") ?? new URL(req.url).searchParams.get("surface");
  return v === "phone" || v === "desk" ? v : null;
}

function cookies(req: Request): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out.set(k, decodeURIComponent(v.join("=")));
  }
  return out;
}

export function tokenFrom(req: Request): string | null {
  const jar = cookies(req);
  const s = surfaceOf(req);
  if (s) return jar.get(cookieName(s)) ?? null;
  return jar.get(cookieName("desk")) ?? jar.get(cookieName("phone")) ?? null;
}

/** The signed-in person behind a request, or null. */
export async function actorOf(req: Request): Promise<Actor> {
  const s = await (await identity()).session(tokenFrom(req));
  return s ? { person: s.person, deviceId: s.deviceId } : null;
}

export function sessionCookie(req: Request, surface: Surface, token: string) {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName(surface)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export const clearCookie = (surface: Surface) => `${cookieName(surface)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** A refusal as a response: 401 when nobody is signed in, 403 when the person may not do this. */
export function refuse(reason: string) {
  return Response.json({ error: reason }, { status: reason === NOT_SIGNED_IN ? 401 : 403 });
}

/**
 * A fixed-window rate limit per key (a session, a device or an address), in this process's memory.
 * Enough for one server; Phase 2 moves it to Postgres with the job runner.
 */
const windows = new Map<string, { start: number; n: number }>();
let lastPurge = 0;
export function limited(key: string, max: number, windowMs: number, now = Date.now()): number | null {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, n: 1 });
    if (windows.size > 20_000 && now - lastPurge > 10_000) {
      lastPurge = now;
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    }
    return null;
  }
  w.n += 1;
  return w.n > max ? w.start + windowMs - now : null;
}

export function tooMany(retryAfterMs: number) {
  return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } });
}


/**
 * The caller's address, for limits on requests made before signing in. A forwarded address is believed
 * only behind a proxy we run (KHETKUNDLI_TRUSTED_PROXY=1, e.g. Caddy on the VPS); otherwise any client
 * could pick its own address and walk around the limits, so all direct callers share one key.
 */
export function clientAddress(req: Request): string {
  if (process.env.KHETKUNDLI_TRUSTED_PROXY === "1") {
    const fwd = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (fwd) return fwd;
  }
  return "direct";
}

/** The largest body any route accepts: a full batch of 200 season events fits in well under this. */
export const MAX_BODY_BYTES = 256 * 1024;

/**
 * Read a POST body as JSON, safely: refused if it comes from another site (a browser always sends
 * Origin on a cross-site POST), if it is larger than the limit, or if it is not JSON. Returns the value
 * or a ready response.
 */
export async function readJson(req: Request, maxBytes = MAX_BODY_BYTES): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const origin = req.headers.get("origin");
  if (origin) {
    let same = false;
    try { same = new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host); } catch { same = false; }
    if (!same) return { ok: false, response: Response.json({ error: "Requests from another site are not accepted." }, { status: 403 }) };
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, response: Response.json({ error: "Request too large." }, { status: 413 }) };
  const text = await req.text().catch(() => "");
  if (text.length > maxBytes) return { ok: false, response: Response.json({ error: "Request too large." }, { status: 413 }) };
  try {
    return { ok: true, body: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, response: Response.json({ error: "Not JSON." }, { status: 400 }) };
  }
}
