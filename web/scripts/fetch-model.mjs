// Downloads model weights into public/ on install, so they are not stored in git.
// Scan Lens: onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX (licence listed as "other").
// Sale-slip reader: Tesseract's English LSTM model (Apache-2.0), via the @tesseract.js-data package.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = [
  {
    name: "scan model",
    out: "public/models/plant-disease/model_fp32.onnx",
    url: "https://huggingface.co/onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX/resolve/main/onnx/model.onnx",
  },
  {
    name: "slip reader language model",
    out: "public/tesseract/lang/eng.traineddata.gz",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz",
  },
];

for (const m of MODELS) {
  const out = resolve(root, m.out);
  if (existsSync(out)) {
    console.log(`${m.name} already present`);
    continue;
  }
  try {
    mkdirSync(dirname(out), { recursive: true });
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`${m.name} downloaded to ${m.out}`);
  } catch (err) {
    // Never fail the install: each feature reports its missing model on screen instead.
    console.warn(`could not download the ${m.name} (${err.message}); run \`node scripts/fetch-model.mjs\` later`);
  }
}
