import { connection } from "next/server";
import { KB_INFO } from "@/lib/agent/kb";
import { AGENT_MODEL, EMBED_MODEL, health } from "@/lib/agent/llm";
import { ROUTER_INFO } from "@/lib/agent/router";
import embedModel from "@/data/router-embed.json";
import charModel from "@/data/router-model.json";

/** What the agent runs on right now: the local model server, the router and the knowledge base. */
export async function GET() {
  await connection();
  const h = await health();
  return Response.json({
    llm: { server: h.up ? "up" : "down", model: AGENT_MODEL, available: h.models.includes(AGENT_MODEL), embedModel: EMBED_MODEL, embedAvailable: h.models.some((m) => m.startsWith(EMBED_MODEL)) },
    router: { ...ROUTER_INFO, heldOutAccuracy: { charNgram: charModel.heldOutAccuracy, embedding: embedModel.heldOutAccuracy, ensemble: embedModel.ensembleHeldOutAccuracy } },
    knowledge: KB_INFO,
  });
}
