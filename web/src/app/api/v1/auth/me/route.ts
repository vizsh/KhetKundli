import { connection } from "next/server";
import { actorOf } from "@/lib/server/auth";
import { mode, otpSink } from "@/lib/server/mode";
import { identity } from "@/lib/server/seed";

/**
 * GET → who is signed in on this surface (or null), the mode, where sign-in codes go, and on a demo
 * laptop only, the synthetic demo people to choose from.
 */
export async function GET(req: Request) {
  await connection();
  const actor = await actorOf(req);
  // The demo people are listed only on a demo laptop; a pilot never lists who is enrolled.
  const demo = mode() === "demo" && otpSink() === "screen"
    ? (await (await identity()).people()).map((p) => ({ phone: p.phone, name: p.name, nameMr: p.nameMr, role: p.role }))
    : [];
  return Response.json({ person: actor?.person ?? null, mode: mode(), sink: otpSink(), demoPeople: demo });
}
