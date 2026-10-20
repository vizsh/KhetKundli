import { connection } from "next/server";
import type { FarmMessage } from "@/lib/channel";
import { seasonFor } from "@/lib/agent/season-server";
import { clampDay } from "@/lib/sim/calendar";
import { broadcast, recentMessages, saveMessage, saveReceipt } from "@/lib/server/relay";

/**
 * Send approved advisories. Each becomes a message in the local database and goes out to every
 * connected screen at once; Sunita's phone (the demo handset) sends its own delivered and read
 * receipts. For the other farmers there is no handset in the room, so a gateway simulator marks
 * delivery after a few seconds (and, for app users, a read later), labelled as simulated.
 */
type Item = { plot: number; plotId: string; farmer: string; village: string; channel: "app" | "sms"; sms: string; smsMr: string };

export async function GET() {
  await connection();
  return Response.json({ messages: recentMessages() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { items?: Item[]; day?: number };
  const items = (body.items ?? []).filter((x) => Number.isInteger(x.plot) && typeof x.sms === "string").slice(0, 300);
  if (!items.length) return Response.json({ error: "nothing to send" }, { status: 400 });
  const season = await seasonFor(new URL(req.url).origin, {});
  const day = clampDay(Number(body.day ?? 140));
  const batch = `B${Date.now().toString(36)}`;
  const sentAt = new Date().toISOString();
  const sent: FarmMessage[] = items.map((x, i) => ({
    id: `${batch}-${i}`, batch, plot: x.plot, plotId: x.plotId, farmer: x.farmer, village: x.village, channel: x.channel, kind: "advisory",
    day, text: x.sms.slice(0, 160), textMr: String(x.smsMr ?? "").slice(0, 160), sentAt,
  }));
  for (const m of sent) {
    saveMessage(m);
    broadcast({ kind: "message", from: "relay", item: m });
  }
  // Gateway simulator for farmers with no phone in the room.
  for (const m of sent) {
    if (m.plot === season.heroPlot) continue;
    const deliverIn = m.channel === "sms" ? 2500 + Math.random() * 7000 : 1200 + Math.random() * 3500;
    setTimeout(() => {
      const at = new Date().toISOString();
      saveReceipt(m.id, "delivered", at, true);
      broadcast({ kind: "receipt", from: "gateway", id: m.id, status: "delivered", at, simulated: true });
    }, deliverIn);
    if (m.channel === "app" && Math.random() < 0.7) {
      setTimeout(() => {
        const at = new Date().toISOString();
        saveReceipt(m.id, "read", at, true);
        broadcast({ kind: "receipt", from: "gateway", id: m.id, status: "read", at, simulated: true });
      }, deliverIn + 8000 + Math.random() * 40000);
    }
  }
  return Response.json({ batch, sent: sent.length, demoPhone: sent.some((m) => m.plot === season.heroPlot) });
}
