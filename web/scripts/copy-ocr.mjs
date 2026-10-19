// Copies Tesseract.js (worker + LSTM WebAssembly cores) into public/tesseract so the sale-slip
// reader runs on the phone with no CDN. The English model is fetched by fetch-model.mjs.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "public/tesseract");
mkdirSync(resolve(out, "core"), { recursive: true });
copyFileSync(resolve(root, "node_modules/tesseract.js/dist/worker.min.js"), resolve(out, "worker.min.js"));
// The worker picks one of these by the device's SIMD support.
for (const f of ["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"]) {
  copyFileSync(resolve(root, "node_modules/tesseract.js-core", f), resolve(out, "core", f));
}
console.log("tesseract.js copied to public/tesseract");
