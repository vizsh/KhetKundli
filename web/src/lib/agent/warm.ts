import { AGENT_MODEL, EMBED_MODEL, OLLAMA_URL } from "./llm";

/**
 * Load both models into GPU memory when the server starts, so the first question in front of an
 * audience is answered in seconds, not after a 15-second model load. Ollama keeps them for an hour.
 */
export async function warmModels(): Promise<{ chatMs: number | null; embedMs: number | null }> {
  const time = async (path: string, body: unknown) => {
    const t0 = performance.now();
    try {
      const res = await fetch(`${OLLAMA_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
      if (!res.ok) return null;
      await res.json();
      return Math.round(performance.now() - t0);
    } catch {
      return null;
    }
  };
  const [chatMs, embedMs] = await Promise.all([
    time("/api/chat", { model: AGENT_MODEL, messages: [{ role: "user", content: "Reply OK." }], stream: false, keep_alive: "60m", options: { num_predict: 1 } }),
    time("/api/embed", { model: EMBED_MODEL, input: ["warm up"], keep_alive: "60m" }),
  ]);
  console.log(`[khetkundli] models ${chatMs === null ? "not reachable (answers fall back to the rules)" : `warm: ${AGENT_MODEL} ${chatMs} ms, ${EMBED_MODEL} ${embedMs} ms`}`);
  return { chatMs, embedMs };
}
