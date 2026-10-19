"use client";

import type { Worker } from "tesseract.js";
import type { OcrLine } from "@/lib/patti";

export type OcrProgress = { status: string; progress: number };

let reader: Promise<Worker> | null = null;
let listener: ((p: OcrProgress) => void) | null = null;

/** One Tesseract worker per page, created on first use from files served under /tesseract (no CDN). */
export function slipReader(onProgress?: (p: OcrProgress) => void) {
  if (onProgress) listener = onProgress;
  if (!reader) {
    const at = (p: string) => new URL(p, window.location.origin).href;
    reader = import("tesseract.js").then(({ createWorker, OEM }) =>
      createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: at("/tesseract/worker.min.js"),
        corePath: at("/tesseract/core"),
        langPath: at("/tesseract/lang"),
        workerBlobURL: false,
        gzip: true,
        logger: (m) => listener?.({ status: m.status, progress: m.progress }),
      }),
    );
    reader.catch(() => {
      reader = null;
    });
  }
  return reader;
}

/** Reads a slip photo into lines with word boxes and confidences. */
export async function readSlip(image: HTMLCanvasElement, onProgress?: (p: OcrProgress) => void) {
  const worker = await slipReader(onProgress);
  const t0 = performance.now();
  const { data } = await worker.recognize(image, {}, { blocks: true });
  const lines: OcrLine[] = (data.blocks ?? [])
    .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    .map((l) => ({ text: l.text, confidence: l.confidence, bbox: l.bbox, words: l.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })) }));
  return { lines, ms: Math.round(performance.now() - t0), confidence: Math.round(data.confidence) };
}

/** Big camera photos are scaled to about 1,600 px wide: plenty for printed slips, and much faster. */
export function prepareImage(img: CanvasImageSource, w: number, h: number, max = 1600) {
  const k = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, url: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height };
}
