/**
 * Client for a local Ollama server. Models run on this machine (by default Llama 3.1 8B on the
 * laptop GPU); nothing about a farmer leaves it. Set OLLAMA_URL and AGENT_MODEL to change them.
 */
export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const AGENT_MODEL = process.env.AGENT_MODEL ?? "llama3.1:8b";
export const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
  tool_name?: string;
};

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`Ollama ${path} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function health(): Promise<{ up: boolean; models: string[] }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = (await res.json()) as { models: { name: string }[] };
    return { up: true, models: j.models.map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const j = await post<{ embeddings: number[][] }>("/api/embed", { model: EMBED_MODEL, input: texts, keep_alive: "30m" }, 20000);
  return j.embeddings;
}

export type ChatResult = { message: ChatMessage; evalCount?: number; evalMs?: number; promptCount?: number };

export async function chat(messages: ChatMessage[], o: { tools?: ToolSpec[]; format?: unknown; temperature?: number; timeoutMs?: number; numPredict?: number } = {}): Promise<ChatResult> {
  const j = await post<{ message: ChatMessage; eval_count?: number; eval_duration?: number; prompt_eval_count?: number }>(
    "/api/chat",
    {
      model: AGENT_MODEL,
      messages,
      tools: o.tools,
      format: o.format,
      stream: false,
      keep_alive: "30m",
      options: { temperature: o.temperature ?? 0.2, num_ctx: 8192, num_predict: o.numPredict ?? 700, seed: 7 },
    },
    o.timeoutMs ?? 90000,
  );
  return { message: j.message, evalCount: j.eval_count, evalMs: j.eval_duration ? j.eval_duration / 1e6 : undefined, promptCount: j.prompt_eval_count };
}
