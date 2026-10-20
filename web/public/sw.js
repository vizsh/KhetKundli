// KhetKundli offline support: the farmer phone, Scan Lens, the sale-slip reader and their runtimes keep working without signal.
const CACHE = "khetkundli-v4";
const PRECACHE = [
  "/farmer",
  "/workers/scan-lens.js",
  "/ort/ort.wasm.min.mjs",
  "/ort/ort-wasm-simd-threaded.mjs",
  "/ort/ort-wasm-simd-threaded.wasm",
  "/models/plant-disease/model_fp32.onnx",
  "/models/plant-disease/config.json",
  "/models/pomegranate/model_fp32.onnx",
  "/models/pomegranate/config.json",
  "/models/pomegranate/metrics.json",
  "/samples/samples.json",
  "/samples/s1.jpg",
  "/samples/s2.jpg",
  "/samples/s3.jpg",
  "/samples/slip-fair.jpg",
  "/samples/slip-extra.jpg",
  "/samples/slip-marathi.jpg",
  "/tesseract/worker.min.js",
  "/tesseract/lang/eng.traineddata.gz",
  "/tesseract/lang/mar.traineddata.gz",
];
// The OCR core is cached on first use: the worker picks one of three builds by the device's SIMD support.
const CACHE_FIRST = ["/_next/static/", "/ort/", "/models/", "/workers/", "/samples/", "/tesseract/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (CACHE_FIRST.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages and API calls: network first, the last good copy when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match("/farmer"))),
  );
});
