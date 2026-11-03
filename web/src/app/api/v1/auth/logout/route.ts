import { actorOf, clearCookie, surfaceOf, tokenFrom } from "@/lib/server/auth";
import { identity } from "@/lib/server/seed";

/** POST → revoke this surface's session (X-KK-Surface) and clear its cookie; `?everywhere=1` signs the person out on every device. */
export async function POST(req: Request) {
  const token = tokenFrom(req);
  const actor = await actorOf(req);
  if (actor && new URL(req.url).searchParams.get("everywhere") === "1") await (await identity()).revokeAll(actor.person.id);
  else if (token) await (await identity()).revoke(token);
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": clearCookie(surfaceOf(req) ?? "desk") } });
}
