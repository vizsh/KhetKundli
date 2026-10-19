// Downloads the Scan Lens model into public/models on install, so the weights are not stored in git.
// Source: onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX (licence listed as "other").
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/models/plant-disease/model_fp32.onnx");
const URL_ = "https://huggingface.co/onnx-community/mobilenet_v2_1.0_224-plant-disease-identification-ONNX/resolve/main/onnx/model.onnx";

if (existsSync(out)) {
  console.log("scan model already present");
} else {
  try {
    mkdirSync(dirname(out), { recursive: true });
    const res = await fetch(URL_);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log("scan model downloaded to public/models/plant-disease/model_fp32.onnx");
  } catch (err) {
    // Never fail the install: Scan Lens reports the missing model on screen instead.
    console.warn(`could not download the scan model (${err.message}); run \`node scripts/fetch-model.mjs\` later`);
  }
}
