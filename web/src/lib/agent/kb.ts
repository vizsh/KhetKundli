import kb from "@/data/kb-index.json";
import { embed } from "./llm";

/**
 * Retrieval over the project's agronomy and model notes (scripts/build-kb.mts): cosine similarity
 * on local nomic-embed-text vectors, blended with a keyword score so exact terms (Bordeaux, hamali,
 * PHI) still win. With no embedding server, the keyword score alone answers.
 */
type Chunk = { id: string; doc: string; heading: string; text: string; vec: number[] };
const CHUNKS = (kb as unknown as { chunks: Chunk[] }).chunks;

const words = (t: string) => t.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
const DF = new Map<string, number>();
for (const c of CHUNKS) for (const w of new Set(words(`${c.heading} ${c.text}`))) DF.set(w, (DF.get(w) ?? 0) + 1);

function keyword(q: string, c: Chunk) {
  const body = words(`${c.heading} ${c.heading} ${c.text}`);
  const tf = new Map<string, number>();
  for (const w of body) tf.set(w, (tf.get(w) ?? 0) + 1);
  let s = 0;
  for (const w of new Set(words(q))) {
    const f = tf.get(w);
    if (f) s += (1 + Math.log(f)) * Math.log(1 + CHUNKS.length / (DF.get(w) ?? 1));
  }
  return s;
}

export async function searchKb(query: string, k = 3) {
  let qv: number[] | null = null;
  try {
    [qv] = await embed([`search_query: ${query}`]);
    const n = Math.sqrt(qv.reduce((a, b) => a + b * b, 0)) || 1;
    qv = qv.map((x) => x / n);
  } catch {
    qv = null;
  }
  const kw = CHUNKS.map((c) => keyword(query, c));
  const kwMax = Math.max(1e-9, ...kw);
  return CHUNKS.map((c, i) => {
    const cos = qv ? c.vec.reduce((a, v, j) => a + v * qv![j], 0) : 0;
    return { ...c, score: (qv ? 0.75 * cos : 0) + 0.25 * (kw[i] / kwMax) };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((c) => ({ id: c.id, doc: c.doc, heading: c.heading, text: c.text, score: c.score }));
}

export const KB_INFO = { passages: CHUNKS.length, docs: [...new Set(CHUNKS.map((c) => c.doc))] };
