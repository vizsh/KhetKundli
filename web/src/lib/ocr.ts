"use client";

import type { Worker } from "tesseract.js";
import type { OcrLine } from "@/lib/patti";

export type OcrProgress = { status: string; progress: number };

const readers = new Map<string, Promise<Worker>>();
let listener: ((p: OcrProgress) => void) | null = null;

/**
 * One Tesseract worker per language set, created on first use from files served under /tesseract
 * (no CDN). English is loaded when the sheet opens; Marathi (2 MB more) only when a slip needs it.
 */
export function slipReader(onProgress?: (p: OcrProgress) => void, langs: string[] = ["eng"]) {
  if (onProgress) listener = onProgress;
  const key = langs.join("+");
  let reader = readers.get(key);
  if (!reader) {
    const at = (p: string) => new URL(p, window.location.origin).href;
    reader = import("tesseract.js").then(({ createWorker, OEM }) =>
      createWorker(langs, OEM.LSTM_ONLY, {
        workerPath: at("/tesseract/worker.min.js"),
        corePath: at("/tesseract/core"),
        langPath: at("/tesseract/lang"),
        workerBlobURL: false,
        gzip: true,
        logger: (m) => listener?.({ status: m.status, progress: m.progress }),
      }),
    );
    reader.catch(() => readers.delete(key));
    readers.set(key, reader);
  }
  return reader;
}

/** Reads a slip photo into lines with word boxes and confidences. */
export async function readSlip(image: HTMLCanvasElement, langs: string[] = ["eng"], onProgress?: (p: OcrProgress) => void) {
  const worker = await slipReader(onProgress, langs);
  const t0 = performance.now();
  const { data } = await worker.recognize(image, {}, { blocks: true });
  const lines: OcrLine[] = (data.blocks ?? [])
    .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
    .map((l) => ({ text: l.text, confidence: l.confidence, bbox: l.bbox, words: l.words.map((w) => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })) }));
  return { lines, ms: Math.round(performance.now() - t0), confidence: Math.round(data.confidence) };
}

/**
 * Camera photos over 2,000 px are scaled down (plenty for printed slips, and faster); small photos
 * are scaled up to about 1,400 px, since Tesseract needs Devanagari digits a good size; anything in
 * between is read as it is.
 */
export function prepareImage(img: CanvasImageSource, w: number, h: number) {
  const long = Math.max(w, h);
  const k = long > 2000 ? 2000 / long : long < 1000 ? Math.min(2, 1400 / long) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, url: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height };
}
