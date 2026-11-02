import { connection } from "next/server";
import { actorOf, refuse } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { eventStore } from "@/lib/server/event-store";

/** Walk the season record's hash chain: ok with the head hash, or the first row that does not hold. Signed in only. */
export async function GET(req: Request) {
  await connection();
  const denied = can(await actorOf(req), "read-season");
  if (denied) return refuse(denied);
  const store = await eventStore();
  const [chain, head] = await Promise.all([store.verifyChain(), store.head()]);
  return Response.json({ ...chain, database: store.sql.kind, events: head.count, checkedAt: new Date().toISOString() });
}
