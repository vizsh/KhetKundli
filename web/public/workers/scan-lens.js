// Scan Lens worker: on-device classification with ONNX Runtime Web (WebAssembly, single thread).
// Two models, loaded on first use and cached by the service worker for offline scans:
//   plant        MobileNetV2 fine-tuned on PlantVillage (onnx-community), for tomato and capsicum leaves
//   pomegranate  MobileNetV3-Large fine-tuned on this laptop on 5,099 pomegranate fruit photos (ml/scanlens)
// Both take a 224 x 224 RGB image scaled to [-1, 1]. fp32 runs about 5x faster than INT8 on the WebAssembly backend.
import * as ort from "/ort/ort.wasm.min.mjs";

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = 1;

const MODELS = {
  plant: { model: "/models/plant-disease/model_fp32.onnx", config: "/models/plant-disease/config.json" },
  pomegranate: { model: "/models/pomegranate/model_fp32.onnx", config: "/models/pomegranate/config.json" },
};
const SIZE = 224;
const GRID = 7;
const loaded = {};

async function load(name = "plant") {
  if (loaded[name]) return loaded[name];
  const spec = MODELS[name];
  if (!spec) throw new Error(`no model ${name}`);
  const t0 = performance.now();
  const cfg = await fetch(spec.config).then((r) => {
    if (!r.ok) throw new Error(`model ${name} is not installed`);
    return r.json();
  });
  const session = await ort.InferenceSession.create(spec.model, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  loaded[name] = { session, labels: cfg.id2label };
  postMessage({ type: "ready", model: name, ms: Math.round(performance.now() - t0), classes: Object.keys(cfg.id2label).length });
  return loaded[name];
}

function softmax(logits) {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const exps = Array.from(logits, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/** Runs n images in one batch and returns each image's softmax. */
async function batchProbs(session, batch, n) {
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
      await load(msg.model);
      return;
    }
    if (msg.type === "classify") {
      const { session, labels } = await load(msg.model);
      const t0 = performance.now();
      const [p] = await batchProbs(session, msg.pixels, 1);
      const all = p.map((v, i) => ({ label: labels[i], p: v, i }));
      const raw = [...all].sort((a, b) => b.p - a.p).slice(0, 3);
      // For the 38-class plant model the farmer names the crop, so the decision is made among that crop's classes, renormalised.
      const only = msg.crop ? new RegExp(msg.crop) : null;
      const pool = only ? all.filter((c) => only.test(c.label)) : all;
      const mass = pool.reduce((a, c) => a + c.p, 0) || 1;
      const ranked = pool.map((c) => ({ label: c.label, p: c.p / mass, i: c.i })).sort((a, b) => b.p - a.p);
      const top = ranked[0].i;
      postMessage({ type: "result", model: msg.model ?? "plant", top: ranked.slice(0, 3).map(({ label, p }) => ({ label, p })), raw: raw.map(({ label, p }) => ({ label, p })), cropShare: only ? mass : 1, ms: Math.round(performance.now() - t0) });

      // Occlusion map: grey out one patch at a time and measure how far the top class falls.
      const heat = new Float32Array(GRID * GRID);
      const patch = SIZE / GRID;
      const one = 3 * SIZE * SIZE;
      for (let gy = 0; gy < GRID; gy++) {
        // One batch per row of patches: GRID copies of the image, each with a different patch greyed out.
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
        const qs = await batchProbs(session, batch, GRID);
        qs.forEach((q, gx) => { heat[gy * GRID + gx] = Math.max(0, p[top] - q[top]); });
        postMessage({ type: "progress", done: (gy + 1) / GRID });
      }
      const peak = Math.max(...heat) || 1;
      postMessage({ type: "heat", heat: Array.from(heat, (v) => v / peak), grid: GRID, ms: Math.round(performance.now() - t0) });
    }
  } catch (err) {
    postMessage({ type: "error", model: msg.model, message: String(err && err.message ? err.message : err) });
  }
};
