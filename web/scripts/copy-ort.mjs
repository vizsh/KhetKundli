// Copies ONNX Runtime Web's WebAssembly build into public/ort so Scan Lens runs offline, with no CDN.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "node_modules/onnxruntime-web/dist");
const out = resolve(root, "public/ort");
mkdirSync(out, { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  copyFileSync(resolve(src, f), resolve(out, f));
}
console.log("onnxruntime-web copied to public/ort");
