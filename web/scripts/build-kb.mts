// Builds the agent's knowledge base: the project's agronomy, model and problem documents, cut into
// passages by heading and embedded with nomic-embed-text on the local Ollama server.
// npm run build:kb   → src/data/kb-index.json
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const DOCS = ["docs/AGRONOMY.md", "docs/MODELS.md", "docs/PROBLEM.md", "docs/GLOSSARY.md", "docs/DATA.md", "docs/ROADMAP.md"];
const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MAX = 900;

type Chunk = { id: string; doc: string; heading: string; text: string; vec?: number[] };

function clean(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunks(doc: string): Chunk[] {
  const md = readFileSync(resolve(ROOT, doc), "utf8").replace(/\r\n/g, "\n");
  const out: Chunk[] = [];
  let heading = doc;
  let buf = "";
  const flush = () => {
    const text = clean(buf);
    if (text.length > 60) {
      // Long sections become several passages, split on paragraph boundaries.
      let part = "";
      for (const para of text.split(/\n\n/)) {
        if ((part + para).length > MAX && part) {
          out.push({ id: `${doc}#${out.length}`, doc, heading, text: part.trim() });
          part = "";
        }
        part += para + "\n\n";
      }
      if (part.trim().length > 60) out.push({ id: `${doc}#${out.length}`, doc, heading, text: part.trim() });
    }
    buf = "";
  };
  for (const line of md.split("\n")) {
    const h = line.match(/^#{1,3}\s+(.*)/);
    if (h) {
      flush();
      heading = h[1].replace(/[*`]/g, "");
    } else buf += line + "\n";
  }
  flush();
  return out;
}

const all = DOCS.flatMap(chunks);
const vecs: number[][] = [];
for (let i = 0; i < all.length; i += 32) {
  const batch = all.slice(i, i + 32).map((c) => `search_document: ${c.heading}. ${c.text}`);
  const res = await fetch(`${OLLAMA}/api/embed`, { method: "POST", body: JSON.stringify({ model: "nomic-embed-text", input: batch }) });
  if (!res.ok) throw new Error(`embed failed: ${res.status}`);
  vecs.push(...((await res.json()) as { embeddings: number[][] }).embeddings);
}
all.forEach((c, i) => {
  const v = vecs[i];
  const n = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  c.vec = v.map((x) => Math.round((x / n) * 1e4) / 1e4);
});
writeFileSync(resolve(import.meta.dirname, "../src/data/kb-index.json"), JSON.stringify({ model: "nomic-embed-text", built: new Date().toISOString().slice(0, 10), chunks: all }));
console.log(`kb: ${all.length} passages from ${DOCS.length} documents`);
