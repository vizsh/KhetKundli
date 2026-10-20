import { connection } from "next/server";
import { KB_INFO } from "@/lib/agent/kb";
import { AGENT_MODEL, EMBED_MODEL, health } from "@/lib/agent/llm";
import { DB_FILE, db, eventCount, listSnapshots } from "@/lib/server/db";
import { relay } from "@/lib/server/relay";
import { OFFLINE } from "@/lib/server/snapshot";
import embedModel from "@/data/router-embed.json";

/** Everything the demo depends on, in one answer: models, database, saved forecast, connected screens. */
export async function GET() {
  await connection();
  const h = await health();
  const d = db();
  const one = (q: string) => Number((d.prepare(q).get() as { n: number }).n);
  const recent = d.prepare("select at, question, intent, engine, guard_passed as guard, ms from agent_log order by id desc limit 8").all();
  return Response.json({
    mode: { offline: OFFLINE, node: process.version },
    models: { server: h.up ? "up" : "down", agent: AGENT_MODEL, agentReady: h.models.includes(AGENT_MODEL), embed: EMBED_MODEL, embedReady: h.models.some((m) => m.startsWith(EMBED_MODEL)), routerAccuracy: embedModel.ensembleHeldOutAccuracy, knowledgePassages: KB_INFO.passages },
    database: { file: DB_FILE, events: eventCount(), messages: one("select count(*) as n from messages"), delivered: one("select count(*) as n from messages where delivered_at is not null"), read: one("select count(*) as n from messages where read_at is not null"), agentAnswers: one("select count(*) as n from agent_log"), inbox: relay().inbox.length },
    snapshots: listSnapshots(),
    screens: relay().subscribers.size,
    recentAnswers: recent,
  });
}
