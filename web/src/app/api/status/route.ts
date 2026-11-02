import { connection } from "next/server";
import { KB_INFO } from "@/lib/agent/kb";
import { AGENT_MODEL, EMBED_MODEL, health } from "@/lib/agent/llm";
import { actorOf, refuse } from "@/lib/server/auth";
import { can } from "@/lib/server/authz";
import { DB_FILE, db, eventCount, listSnapshots } from "@/lib/server/db";
import { otpSink } from "@/lib/server/identity";
import { database } from "@/lib/server/pg";
import { eventStore } from "@/lib/server/event-store";
import { relay } from "@/lib/server/relay";
import { OFFLINE } from "@/lib/server/snapshot";
import embedModel from "@/data/router-embed.json";

/** Everything the demo depends on, in one answer: models, database, saved forecast, connected screens. */
export async function GET(req: Request) {
  await connection();
  const denied = can(await actorOf(req), "status");
  if (denied) return refuse(denied);
  const pg = await database();
  const count = async (q: string) => Number((await pg.query<{ n: string }>(q))[0].n);
  const [messages, delivered, read, inbox, people, sessions] = await Promise.all([
    count("select count(*) as n from messages"),
    count("select count(*) as n from messages where delivered_at is not null"),
    count("select count(*) as n from messages where read_at is not null"),
    count("select count(*) as n from escalations"),
    count("select count(*) as n from people"),
    count("select count(*) as n from sessions where revoked_at is null and expires_at > now()"),
  ]);
  const h = await health();
  const d = db();
  const one = (q: string) => Number((d.prepare(q).get() as { n: number }).n);
  const store = await eventStore().catch(() => null);
  const chain = store ? await store.verifyChain() : null;
  const recent = d.prepare("select at, question, intent, engine, guard_passed as guard, ms from agent_log order by id desc limit 8").all();
  return Response.json({
    mode: { offline: OFFLINE, node: process.version },
    models: { server: h.up ? "up" : "down", agent: AGENT_MODEL, agentReady: h.models.includes(AGENT_MODEL), embed: EMBED_MODEL, embedReady: h.models.some((m) => m.startsWith(EMBED_MODEL)), routerAccuracy: embedModel.ensembleHeldOutAccuracy, knowledgePassages: KB_INFO.passages },
    database: { file: DB_FILE, events: eventCount(), messages, delivered, read, agentAnswers: one("select count(*) as n from agent_log"), inbox },
    access: { otpSink: otpSink(), people, sessions },
    record: store && chain
      ? { database: store.sql.kind, events: chain.count, chainOk: chain.ok, head: chain.ok ? chain.head.slice(0, 16) : null, brokenAt: chain.ok ? null : chain.seq }
      : { database: "unavailable", events: 0, chainOk: false, head: null, brokenAt: null },
    snapshots: listSnapshots(),
    screens: relay().subscribers.size,
    recentAnswers: recent,
  });
}
