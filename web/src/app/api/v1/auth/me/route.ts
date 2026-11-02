import { connection } from "next/server";
import { actorOf } from "@/lib/server/auth";
import { otpSink } from "@/lib/server/identity";
import { identity } from "@/lib/server/seed";

/**
 * GET → who is signed in on this browser (or null), and, for the sign-in sheet while there is no SMS
 * sender, the demo's people to choose from. That list is shown only with the on-screen code sink.
 */
export async function GET(req: Request) {
  await connection();
  const actor = await actorOf(req);
  const demo = otpSink() === "screen"
    ? (await (await identity()).people()).map((p) => ({ phone: p.phone, name: p.name, nameMr: p.nameMr, role: p.role }))
    : [];
  return Response.json({ person: actor?.person ?? null, sink: otpSink(), demoPeople: demo });
}
