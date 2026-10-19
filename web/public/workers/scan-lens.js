// Scan Lens worker: on-device leaf classification with ONNX Runtime Web (WebAssembly, single thread).
// Model: MobileNetV2 fine-tuned on PlantVillage, fp32 ONNX (onnx-community). Runs fully offline once cached.
// fp32 is used in the browser because ONNX Runtime's WebAssembly backend runs it about 5x faster than the INT8 build;
// the INT8 build is the one meant for the Snapdragon NPU path.
import * as ort from "/ort/ort.wasm.min.mjs";

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = 1;

const MODEL = "/models/plant-disease/model_fp32.onnx";
const CONFIG = "/models/plant-disease/config.json";
const SIZE = 224;
const GRID = 7;

let session = null;
let labels = null;

async function load() {
  if (session) return;
  const t0 = performance.now();
  const cfg = await fetch(CONFIG).then((r) => r.json());
  labels = cfg.id2label;
  session = await ort.InferenceSession.create(MODEL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  postMessage({ type: "ready", ms: Math.round(performance.now() - t0), classes: Object.keys(labels).length });
}

function softmax(logits) {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

async function probs(pixels) {
  const input = new ort.Tensor("float32", pixels, [1, 3, SIZE, SIZE]);
  const out = await session.run({ [session.inputNames[0]]: input });
  return softmax(out[session.outputNames[0]].data);
}

/** Runs n images in one batch and returns each image's softmax. */
async function batchProbs(batch, n) {
  const input = new ort.Tensor("float32", batch, [n, 3, SIZE, SIZE]);
  const out = await session.run({ [session.inputNames[0]]: input });
  const logits = out[session.outputNames[0]].data;
  const k = logits.length / n;
  return Array.from({ length: n }, (_, i) => softmax(logits.subarray(i * k, (i + 1) * k)));
}

onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load();
      return;
    }
    if (msg.type === "classify") {
      await load();
      const t0 = performance.now();
      const p = await probs(msg.pixels);
      const all = p.map((v, i) => ({ label: labels[i], p: v, i }));
      const raw = [...all].sort((a, b) => b.p - a.p).slice(0, 3);
      // The farmer names the crop, so the decision is made among that crop's classes only, renormalised.
      const only = msg.crop ? new RegExp(msg.crop) : null;
      const pool = only ? all.filter((c) => only.test(c.label)) : all;
      const mass = pool.reduce((a, c) => a + c.p, 0) || 1;
      const ranked = pool.map((c) => ({ label: c.label, p: c.p / mass, i: c.i })).sort((a, b) => b.p - a.p);
      const top = ranked[0].i;
      postMessage({ type: "result", top: ranked.slice(0, 3).map(({ label, p }) => ({ label, p })), raw: raw.map(({ label, p }) => ({ label, p })), cropShare: only ? mass : 1, ms: Math.round(performance.now() - t0) });

      // Occlusion map: grey out one patch at a time and measure how far the top class falls.
      const heat = new Float32Array(GRID * GRID);
      const patch = SIZE / GRID;
      const one = 3 * SIZE * SIZE;
      for (let gy = 0; gy < GRID; gy++) {
        // One batch per row of patches: GRID copies of the leaf, each with a different patch greyed out.
        const batch = new Float32Array(GRID * one);
        for (let gx = 0; gx < GRID; gx++) {
          batch.set(msg.pixels, gx * one);
          for (let c = 0; c < 3; c++) {
            for (let y = gy * patch; y < (gy + 1) * patch; y++) {
              const row = gx * one + c * SIZE * SIZE + y * SIZE;
              batch.fill(0, row + gx * patch, row + (gx + 1) * patch);
            }
          }
        }
        const qs = await batchProbs(batch, GRID);
        qs.forEach((q, gx) => { heat[gy * GRID + gx] = Math.max(0, p[top] - q[top]); });
        postMessage({ type: "progress", done: (gy + 1) / GRID });
      }
      const peak = Math.max(...heat) || 1;
      postMessage({ type: "heat", heat: Array.from(heat, (v) => v / peak), grid: GRID, ms: Math.round(performance.now() - t0) });
    }
  } catch (err) {
    postMessage({ type: "error", message: String(err && err.message ? err.message : err) });
  }
};
