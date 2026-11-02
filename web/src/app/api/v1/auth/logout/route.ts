import { clearCookie, surfaceOf, tokenFrom } from "@/lib/server/auth";
import { identity } from "@/lib/server/seed";

/** POST → revoke this surface's session (X-KK-Surface) and clear its cookie. */
export async function POST(req: Request) {
  const token = tokenFrom(req);
  if (token) await (await identity()).revoke(token);
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": clearCookie(surfaceOf(req) ?? "desk") } });
}
