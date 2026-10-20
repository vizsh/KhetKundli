import charModel from "@/data/router-model.json";
import embedModel from "@/data/router-embed.json";

/**
 * The question router, trained on this machine (ml/router/train.py): a character n-gram TF-IDF +
 * logistic regression that runs anywhere, and a logistic regression over local nomic-embed-text
 * sentence embeddings that runs when the Ollama server is up. Their probabilities are averaged.
 * The char_wb analyser below reproduces scikit-learn's exactly (scripts/router-parity.ts checks it).
 */
export type RouteIntent =
  | "spray_failed" | "next_spray" | "irrigation" | "harvest_market" | "blight_risk"
  | "sale_slip" | "transport" | "weather" | "export" | "other";

export type Route = { intent: RouteIntent; confidence: number; probs: Record<string, number>; models: string[]; lang: "mr" | "en" | "mixed" };

type CharModel = { classes: string[]; features: string[]; idf: number[]; coef: number[][]; intercept: number[]; ngram: [number, number] };
const M = charModel as unknown as CharModel;
const E = embedModel as unknown as { classes: string[]; coef: number[][]; intercept: number[]; prefix: string; model: string };
const INDEX = new Map(M.features.map((f, i) => [f, i]));

export function charWbNgrams(text: string, [lo, hi]: [number, number] = M.ngram): string[] {
  const out: string[] = [];
  const doc = text.toLowerCase().replace(/\s\s+/g, " ");
  for (const raw of doc.split(/\s+/).filter(Boolean)) {
    const w = ` ${raw} `;
    for (let n = lo; n <= hi; n++) {
      let offset = 0;
      out.push(w.slice(offset, offset + n));
      while (offset + n < w.length) {
        offset += 1;
        out.push(w.slice(offset, offset + n));
      }
      if (offset === 0) break;
    }
  }
  return out;
}

const softmax = (z: number[]) => {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};

export function charProbs(text: string): number[] {
  const tf = new Map<number, number>();
  for (const g of charWbNgrams(text)) {
    const i = INDEX.get(g);
    if (i !== undefined) tf.set(i, (tf.get(i) ?? 0) + 1);
  }
  let norm = 0;
  const x: [number, number][] = [];
  for (const [i, c] of tf) {
    const v = (1 + Math.log(c)) * M.idf[i];
    x.push([i, v]);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  const z = M.classes.map((_, k) => M.intercept[k] + x.reduce((a, [i, v]) => a + (v / norm) * M.coef[k][i], 0));
  return softmax(z);
}

export function embedProbs(vec: number[]): number[] {
  const n = Math.sqrt(vec.reduce((a, b) => a + b * b, 0)) || 1;
  const z = E.classes.map((_, k) => E.intercept[k] + E.coef[k].reduce((a, c, i) => a + (c * vec[i]) / n, 0));
  return softmax(z);
}

export const EMBED_PREFIX = E.prefix;

export function langOf(text: string): Route["lang"] {
  const dev = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const lat = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (dev && lat) return dev > lat * 2 ? "mr" : "mixed";
  return dev ? "mr" : "en";
}

/** Route a question; pass the question's embedding when the embedding model is available. */
export function route(text: string, embedding?: number[] | null): Route {
  const pc = charProbs(text);
  const pe = embedding ? embedProbs(embedding) : null;
  const p = pe ? pc.map((v, i) => (v + pe[i]) / 2) : pc;
  const best = p.indexOf(Math.max(...p));
  return {
    intent: M.classes[best] as RouteIntent,
    confidence: p[best],
    probs: Object.fromEntries(M.classes.map((c, i) => [c, Math.round(p[i] * 1000) / 1000])),
    models: pe ? ["char-ngram", "embedding"] : ["char-ngram"],
    lang: langOf(text),
  };
}

export const ROUTER_INFO = { classes: M.classes, features: M.features.length, embedModel: E.model };
