import { connection } from "next/server";
import { eventStore } from "@/lib/server/event-store";

/** Walk the season record's hash chain: ok with the head hash, or the first row that does not hold. */
export async function GET() {
  await connection();
  const store = await eventStore();
  const [chain, head] = await Promise.all([store.verifyChain(), store.head()]);
  return Response.json({ ...chain, database: store.sql.kind, events: head.count, checkedAt: new Date().toISOString() });
}
