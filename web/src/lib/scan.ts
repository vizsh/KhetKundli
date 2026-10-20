"use client";

export type Ranked = { label: string; p: number };
export type ScanEvent =
  | { type: "ready"; ms: number; classes: number }
  | { type: "result"; top: Ranked[]; raw: Ranked[]; cropShare: number; ms: number }
  | { type: "progress"; done: number }
  | { type: "heat"; heat: number[]; grid: number; ms: number }
  | { type: "error"; message: string };

const SIZE = 224;
let worker: Worker | null = null;

export function scanWorker() {
  if (!worker) worker = new Worker("/workers/scan-lens.js", { type: "module" });
  return worker;
}

/** Resize the shortest edge to 256, centre-crop 224, normalise to [-1, 1] (MobileNetV2 preprocessing). */
export function preprocess(source: CanvasImageSource, sw: number, sh: number) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const scale = 256 / Math.min(sw, sh);
  const crop = SIZE / scale;
  ctx.drawImage(source, (sw - crop) / 2, (sh - crop) / 2, crop, crop, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const pixels = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    pixels[i] = (data[i * 4] / 255 - 0.5) / 0.5;
    pixels[SIZE * SIZE + i] = (data[i * 4 + 1] / 255 - 0.5) / 0.5;
    pixels[2 * SIZE * SIZE + i] = (data[i * 4 + 2] / 255 - 0.5) / 0.5;
  }
  return { pixels, preview: canvas.toDataURL("image/jpeg", 0.9) };
}

export type ScanCrop = "pomegranate" | "tomato" | "capsicum";

export const CROPS: { id: ScanCrop; en: string; mr: string; live: boolean }[] = [
  { id: "pomegranate", en: "Pomegranate", mr: "डाळिंब", live: false },
  { id: "tomato", en: "Tomato", mr: "टोमॅटो", live: true },
  { id: "capsicum", en: "Capsicum", mr: "ढोबळी मिरची", live: true },
];

export const MATCH: Record<Exclude<ScanCrop, "pomegranate">, RegExp> = { tomato: /Tomato/, capsicum: /Bell Pepper/ };

export type Advice = { en: string; mr: string; tone: "alert" | "act" | "calm" };

/**
 * Fixed action table for the on-device model's tomato and capsicum classes. Categories only:
 * the product dose comes from the label and the local agriculture assistant, never from this app.
 */
export function adviceFor(label: string): Advice {
  if (/Healthy/.test(label)) return { tone: "calm", en: "Looks healthy. Scan again if spots appear.", mr: "पान निरोगी दिसते. डाग दिसल्यास पुन्हा स्कॅन करा." };
  if (/Bacterial Spot/.test(label)) return { tone: "alert", en: "Bacterial spot. Remove badly spotted leaves; spray a copper-based bactericide at the label dose in a dry morning window.", mr: "जिवाणूजन्य ठिपके. जास्त डाग असलेली पाने काढा; कोरड्या सकाळी तांबेयुक्त जिवाणूनाशक लेबलवरील प्रमाणात फवारा." };
  if (/Early Blight|Late Blight|Septoria|Target Spot|Leaf Mold/.test(label)) return { tone: "alert", en: "Fungal leaf disease. Remove infected lower leaves, avoid wetting the foliage, and use a recommended fungicide at the label dose.", mr: "बुरशीजन्य पानांचा रोग. खालची रोगट पाने काढा, पानांवर पाणी पडू देऊ नका आणि शिफारस केलेले बुरशीनाशक लेबलवरील प्रमाणात वापरा." };
  if (/Virus/.test(label)) return { tone: "alert", en: "Virus. No spray cures it: pull out infected plants and control whiteflies and aphids that carry it.", mr: "विषाणूजन्य रोग. फवारणीने बरा होत नाही: रोगट झाडे उपटा आणि पांढरी माशी व मावा यांचे नियंत्रण करा." };
  if (/Spider Mites/.test(label)) return { tone: "act", en: "Spider mites. Check the undersides of leaves and use a recommended miticide at the label dose.", mr: "कोळी (माइट्स). पानांच्या खालच्या बाजूला तपासा आणि शिफारस केलेले कोळीनाशक लेबलवरील प्रमाणात वापरा." };
  return { tone: "act", en: "Show this result to your agriculture assistant before spraying.", mr: "फवारणीपूर्वी हा निकाल कृषी सहाय्यकांना दाखवा." };
}

export function cropMismatch(crop: ScanCrop, label: string) {
  return crop !== "pomegranate" && !MATCH[crop].test(label);
}

export type Sample = { file: string; crop: ScanCrop; label: string; credit: string; source: string };

const MR_NAMES: [RegExp, string][] = [
  [/Pomegranate bacterial blight/, "डाळिंब: तेल्या (जिवाणूजन्य करपा)"],
  [/Healthy Tomato/, "निरोगी टोमॅटो"],
  [/Healthy Bell Pepper/, "निरोगी ढोबळी मिरची"],
  [/Bacterial Spot/, "जिवाणूजन्य ठिपके"],
  [/Early Blight/, "लवकर येणारा करपा"],
  [/Late Blight/, "उशिरा येणारा करपा"],
  [/Septoria/, "सेप्टोरिया पानठिपके"],
  [/Leaf Mold/, "पानांवरील बुरशी"],
  [/Target Spot/, "टार्गेट ठिपके"],
  [/Spider Mites/, "कोळी (माइट्स)"],
  [/Yellow Leaf Curl/, "पिवळा पर्णगुच्छ विषाणू"],
  [/Mosaic/, "मोझॅक विषाणू"],
];

/** Marathi name for a model label, when we have one. */
export function mrLabel(label: string) {
  return MR_NAMES.find(([re]) => re.test(label))?.[1] ?? "";
}

export type PhotoIssue = "blurry" | "dark" | "bright" | null;
export type PhotoQuality = { sharp: number; light: number; issue: PhotoIssue };

/**
 * Is the photo good enough to read? Sharpness is the variance of the Laplacian on a 192 px grey copy
 * (sharp leaf photos score in the hundreds to thousands, a 1.5 px blur under 40); light is mean brightness.
 */
export function photoQuality(source: CanvasImageSource, sw: number, sh: number): PhotoQuality {
  const k = 192 / Math.max(sw, sh);
  const w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const grey = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    sum += grey[i];
  }
  let m = 0, m2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = grey[i - w] + grey[i + w] + grey[i - 1] + grey[i + 1] - 4 * grey[i];
      m += lap;
      m2 += lap * lap;
      n++;
    }
  }
  const sharp = Math.round(m2 / n - (m / n) ** 2);
  const light = Math.round(sum / (w * h));
  const issue: PhotoIssue = light < 65 ? "dark" : light > 215 ? "bright" : sharp < 60 ? "blurry" : null;
  return { sharp, light, issue };
}

export const QUALITY_TEXT: Record<Exclude<PhotoIssue, null> | "ok", { en: string; mr: string }> = {
  ok: { en: "Sharp, good light", mr: "स्पष्ट, योग्य उजेड" },
  blurry: { en: "Blurry: hold the phone still and retake", mr: "धूसर: फोन स्थिर धरून पुन्हा फोटो घ्या" },
  dark: { en: "Too dark: face the light and retake", mr: "खूप अंधार: उजेडाकडे तोंड करून पुन्हा घ्या" },
  bright: { en: "Washed out: step out of direct sun and retake", mr: "खूप उजेड: थेट उन्हातून बाजूला होऊन पुन्हा घ्या" },
};
