import { connection } from "next/server";
import { actorOf, refuse } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { identity } from "@/lib/server/seed";
import { broadcast, messagesFor, saveReceipt, sendBatch } from "@/lib/server/relay";

/**
 * Advisory messages.
 *
 * GET  → the messages this person may see (every plot's for staff, her own for a farmer).
 * POST { batchId, exclude? } → send a batch prepared by /api/agent/advisories, once, by the officer.
 *      The text sent is the text stored with the batch; a client cannot change it.
 *
 * Plots whose farmer has an account receive on their phone and send their own receipts. For the other
 * (simulated) farmers there is no handset, so a gateway simulator marks delivery after a few seconds
 * (and, for app users, a read later), labelled as simulated. Phase 2 replaces it with a real SMS gateway.
 */
export async function GET(req: Request) {
  await connection();
  const actor = await actorOf(req);
  if (!actor) return refuse("Sign in first.");
  return Response.json({ messages: await messagesFor(actor) });
}

export async function POST(req: Request) {
  const actor = await actorOf(req);
  const denied = can(actor, "send-advisories");
  if (denied) return refuse(denied);
  const body = (await req.json().catch(() => ({}))) as { batchId?: unknown; exclude?: unknown };
  if (typeof body.batchId !== "string" || body.batchId.length > 64) return Response.json({ error: "send { batchId }" }, { status: 400 });
  const exclude = Array.isArray(body.exclude) ? body.exclude.filter((x): x is number => Number.isInteger(x)).slice(0, 1000) : [];
  const r = await sendBatch(body.batchId, exclude, actor!.person.id);
  if (!r.ok) return Response.json({ error: r.reason }, { status: r.status });

  for (const m of r.messages) broadcast({ kind: "message", from: "relay", item: m });
  // Gateway simulator for farmers with no account (and so no phone in the room).
  const owners = await (await identity()).plotOwners();
  for (const m of r.messages) {
    if (owners.has(m.plot)) continue;
    const deliverIn = m.channel === "sms" ? 2500 + Math.random() * 7000 : 1200 + Math.random() * 3500;
    setTimeout(() => {
      const at = new Date().toISOString();
      void saveReceipt(m.id, "delivered", at, true).then(() => broadcast({ kind: "receipt", from: "gateway", id: m.id, status: "delivered", at, simulated: true, plot: m.plot }));
    }, deliverIn);
    if (m.channel === "app" && Math.random() < 0.7) {
      setTimeout(() => {
        const at = new Date().toISOString();
        void saveReceipt(m.id, "read", at, true).then(() => broadcast({ kind: "receipt", from: "gateway", id: m.id, status: "read", at, simulated: true, plot: m.plot }));
      }, deliverIn + 8000 + Math.random() * 40000);
    }
  }
  return Response.json({ batch: body.batchId, sent: r.messages.length, toPhones: r.messages.filter((m) => owners.has(m.plot)).length });
}
