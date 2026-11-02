import { addressOf, limited, sessionCookie, surfaceOf, tooMany } from "@/lib/server/auth";
import { identity } from "@/lib/server/seed";

/** POST { phone, code, device? } → signs this surface of the browser in (X-KK-Surface): an http-only session cookie and the person. */
export async function POST(req: Request) {
  const wait = limited(`verify:${addressOf(req)}`, 20, 60_000);
  if (wait) return tooMany(wait);
  const body = (await req.json().catch(() => ({}))) as { phone?: unknown; code?: unknown; device?: unknown };
  const label = typeof body.device === "string" && body.device.trim() ? body.device.trim() : "Browser";
  const r = await (await identity()).verifyOtp(body.phone, body.code, { label, userAgent: req.headers.get("user-agent") ?? "" });
  if (!r.ok) return Response.json({ error: r.reason }, { status: 401 });
  return Response.json({ person: r.person, expiresAt: r.expiresAt }, { headers: { "Set-Cookie": sessionCookie(req, surfaceOf(req) ?? "desk", r.token) } });
}
