"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImageUp, Loader2, WifiOff, Wifi, X } from "lucide-react";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { adviceFor, CROPS, cropMismatch, MATCH, mrLabel, photoQuality, preprocess, QUALITY_TEXT, scanWorker, type Advice, type PhotoQuality, type Ranked, type Sample, type ScanCrop, type ScanEvent } from "@/lib/scan";
import { SPRAYS } from "@/lib/sim/rules";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

type Result = {
  crop: ScanCrop;
  preview: string;
  top: Ranked[];
  raw?: Ranked[];
  cropShare?: number;
  ms?: number;
  heat?: number[];
  grid?: number;
  progress?: number;
  simulated: boolean;
  advice: Advice;
};

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    queueMicrotask(() => setOnline(navigator.onLine));
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

function Confidence({ p }: { p: number }) {
  return (
    <p className={cn("typed shrink-0 text-right leading-none", p >= 0.6 ? "text-ink" : "text-alert")}>
      <span className="block text-[30px] font-bold">{Math.round(p * 100)}%</span>
      <span className="block text-[11px] font-normal text-ink-3">sure · खात्री</span>
    </p>
  );
}

function HeatOverlay({ heat, grid }: { heat: number[]; grid: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, grid, grid);
    heat.forEach((v, i) => {
      ctx.fillStyle = `rgba(200,16,46,${(v * 0.75).toFixed(3)})`;
      ctx.fillRect(i % grid, Math.floor(i / grid), 1, 1);
    });
  }, [heat, grid]);
  return <canvas ref={ref} width={grid} height={grid} className="pointer-events-none absolute inset-0 h-full w-full [filter:blur(14px)] [image-rendering:auto]" aria-hidden />;
}

export function ScanLens({ open, onClose }: { open: boolean; onClose: () => void }) {
  const heroScan = useDesk((s) => s.heroScan);
  const online = useOnline();
  const [crop, setCrop] = useState<ScanCrop>("pomegranate");
  const [model, setModel] = useState<{ state: "loading" | "ready" | "error"; ms?: number; error?: string }>({ state: "loading" });
  const [camera, setCamera] = useState<MediaStream | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  /** Photo check of the analysed photo, and of the live viewfinder while the camera is open. */
  const [quality, setQuality] = useState<PhotoQuality | null>(null);
  const [liveQuality, setLiveQuality] = useState<PhotoQuality | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/samples/samples.json").then((r) => r.json()).then(setSamples).catch(() => setSamples([]));
    const w = scanWorker();
    const onMsg = (e: MessageEvent<ScanEvent>) => {
      const m = e.data;
      if (m.type === "ready") setModel({ state: "ready", ms: m.ms });
      if (m.type === "error") setModel({ state: "error", error: m.message });
      if (m.type === "result") setResult((r) => (r ? { ...r, top: m.top, raw: m.raw, cropShare: m.cropShare, ms: m.ms, advice: adviceFor(m.top[0].label), progress: 0 } : r));
      if (m.type === "progress") setResult((r) => (r ? { ...r, progress: m.done } : r));
      if (m.type === "heat") setResult((r) => (r ? { ...r, heat: m.heat, grid: m.grid, progress: 1 } : r));
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "load" });
    return () => w.removeEventListener("message", onMsg);
  }, [open]);

  const stopCamera = useCallback(() => {
    camera?.getTracks().forEach((tr) => tr.stop());
    setCamera(null);
  }, [camera]);

  const close = () => {
    stopCamera();
    setResult(null);
    setSaved(false);
    onClose();
  };
  useEffect(() => { if (video.current && camera) video.current.srcObject = camera; }, [camera]);

  // Twice a second, check the viewfinder: the frame turns violet when the leaf is sharp and well lit.
  useEffect(() => {
    if (!camera) return;
    const id = setInterval(() => {
      const v = video.current;
      if (v && v.videoWidth) setLiveQuality(photoQuality(v, v.videoWidth, v.videoHeight));
    }, 500);
    return () => clearInterval(id);
  }, [camera]);

  const analyse = (source: CanvasImageSource, w: number, h: number) => {
    setQuality(photoQuality(source, w, h));
    const { pixels, preview } = preprocess(source, w, h);
    setSaved(false);
    if (crop === "pomegranate") {
      setResult({
        crop,
        preview,
        simulated: true,
        top: [{ label: "Pomegranate bacterial blight (Telya)", p: 0.87 }],
        advice: { tone: "alert", en: `Spray ${SPRAYS.curative.product}, ${SPRAYS.curative.dose}, in the first dry, calm morning (06:00).`, mr: `${SPRAYS.curative.mr} पहिल्या कोरड्या, शांत सकाळी (६ वाजता) फवारा.` },
      });
      return;
    }
    setResult({ crop, preview, simulated: false, top: [], advice: adviceFor(""), progress: 0 });
    scanWorker().postMessage({ type: "classify", pixels, crop: MATCH[crop].source }, [pixels.buffer]);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
      setResult(null);
      setCamera(stream);
    } catch {
      file.current?.click();
    }
  };

  const capture = () => {
    const v = video.current;
    if (!v) return;
    analyse(v, v.videoWidth, v.videoHeight);
    stopCamera();
  };

  const loadImage = (src: string) => {
    const img = new Image();
    img.onload = () => analyse(img, img.naturalWidth, img.naturalHeight);
    img.src = src;
  };

  const top = result?.top[0];
  const lowConfidence = top && top.p < 0.6;
  const rawTop = result?.raw?.[0];
  const mismatch = rawTop && result && cropMismatch(result.crop, rawTop.label);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-x-0 bottom-0 top-0 z-50 mx-auto flex max-w-[480px] flex-col overflow-y-auto bg-paper"
          role="dialog"
          aria-modal="true"
          aria-label="Scan a leaf"
        >
          <header className="flex items-center justify-between border-b-2 border-ink px-4 py-3">
            <h2 className="flex flex-wrap items-baseline gap-x-2 text-[19px] font-semibold [font-stretch:90%]">
              Scan a leaf <span className="font-marathi text-[17px] font-normal text-ink-2">पानाचा फोटो</span>
            </h2>
            <button type="button" onClick={close} aria-label="Close scan" className="grid size-12 place-items-center rounded-full hover:bg-ink/10">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex items-center justify-between gap-2 border-b border-ink/15 bg-paper-2 px-4 py-2 text-[12.5px]">
            <span className="flex items-center gap-1.5 font-semibold">
              {online ? <Wifi className="size-4" /> : <WifiOff className="size-4 text-alert" />}
              {online ? "Online; nothing leaves this phone" : "Offline: running on this phone"}
              <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>{online ? "फोटो फोनबाहेर जात नाही" : "इंटरनेटशिवाय चालते"}</span>
            </span>
            <span className="typed text-[11.5px] text-ink-3">
              {model.state === "ready" ? `model ready · 9 MB${model.ms ? ` · loaded in ${model.ms} ms` : ""}` : model.state === "loading" ? "loading model…" : "model failed to load"}
            </span>
          </div>

          <div className="px-4 pt-3">
            <p className="label-form text-ink-2">Crop <span className="normal-case tracking-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>पीक</span></p>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {CROPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCrop(c.id); setResult(null); }}
                  aria-pressed={crop === c.id}
                  className={cn("min-h-12 rounded-[3px] border-2 px-2 py-1.5 text-left transition-colors", crop === c.id ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink")}
                >
                  <span className="block text-[14px] font-semibold leading-tight">{c.en}</span>
                  <span className="block text-[13px] leading-tight opacity-80" style={{ fontFamily: "var(--font-anek-deva)" }}>{c.mr}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-snug text-ink-3">
              {crop === "pomegranate"
                ? "Pomegranate model is still being trained on Phaltan photos; this result is a scripted demonstration."
                : "Runs a MobileNetV2 model (PlantVillage, 38 classes) on this phone with ONNX Runtime. 95% on lab photos, but often wrong on field photos until it is retrained on local ones."}
            </p>
          </div>

          <div className="px-4 pt-3">
            <div className="relative mx-auto aspect-square w-full max-w-[340px] border-2 border-dashed border-ink/50 bg-paper-2">
              {!camera && !result && (
                <p className="absolute inset-0 grid place-items-center px-8 text-center text-[13px] uppercase tracking-[0.08em] text-ink-3 [font-stretch:85%]">
                  Affix photograph here
                  <span className="mt-1 block font-marathi text-[15px] normal-case tracking-normal">एक पान, चौकट भरून</span>
                </p>
              )}
              {camera && <video ref={video} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />}
              {camera && liveQuality && (
                <>
                  <div className={cn("pointer-events-none absolute inset-3 border-[3px] transition-colors", liveQuality.issue ? "border-alert/80" : "border-stamp")} />
                  <p className={cn("absolute inset-x-0 top-0 px-3 py-1.5 text-center text-[13px] font-semibold text-paper", liveQuality.issue ? "bg-alert/85" : "bg-stamp/90")}>
                    {liveQuality.issue ? QUALITY_TEXT[liveQuality.issue].en : "Good: take the photo"}
                    <span className="block text-[12.5px] font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>{liveQuality.issue ? QUALITY_TEXT[liveQuality.issue].mr : "छान: फोटो घ्या"}</span>
                  </p>
                </>
              )}
              {result && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.preview} alt="The scanned leaf" className="absolute inset-0 h-full w-full object-cover" />
                  {result.heat && result.grid ? <HeatOverlay heat={result.heat} grid={result.grid} /> : null}
                  {!result.simulated && (result.progress ?? 0) < 1 && (
                    <div className="absolute inset-x-0 bottom-0 bg-ink/75 px-3 py-1.5 text-[12px] text-paper">
                      <Loader2 className="mr-1 inline size-3.5 animate-spin" />
                      {result.top.length ? `Mapping where the model looked… ${Math.round((result.progress ?? 0) * 100)}%` : "Reading the leaf…"}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {camera ? (
                <button type="button" onClick={capture} className="col-span-2 min-h-14 rounded-[3px] bg-ink text-[17px] font-bold text-paper active:scale-[0.99]">
                  Take photo <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>फोटो घ्या</span>
                </button>
              ) : (
                <>
                  <button type="button" onClick={startCamera} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] bg-ink text-[15px] font-bold text-paper active:scale-[0.99]">
                    <Camera className="size-5" /> Camera <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>कॅमेरा</span>
                  </button>
                  <button type="button" onClick={() => file.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border-2 border-ink text-[15px] font-bold active:scale-[0.99]">
                    <ImageUp className="size-5" /> Photo <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>फोटो निवडा</span>
                  </button>
                </>
              )}
              <input
                ref={file}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadImage(URL.createObjectURL(f));
                  e.target.value = "";
                }}
              />
            </div>

            {crop !== "pomegranate" && samples.length > 0 && !camera && (
              <div className="mt-3">
                <p className="label-form text-ink-3">No leaf to hand? Try a sample photo <span className="normal-case tracking-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>नमुना फोटो</span></p>
                <div className="mt-1.5 flex gap-2">
                  {samples.filter((s) => s.crop === crop).map((s) => (
                    <button key={s.file} type="button" onClick={() => loadImage(s.file)} className="w-24 text-left" title={`${s.label}. ${s.credit}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.file} alt={s.label} className="aspect-square w-24 rounded-[2px] border border-ink/30 object-cover" />
                      <span className="mt-0.5 block text-[10px] leading-tight text-ink-3">{s.credit}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {result && top && (
            <motion.section initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-4 mb-6 mt-4 border-t-2 border-ink pt-3">
              {quality && (
                <p className={cn("mb-2 text-[13px] leading-snug", quality.issue ? "font-semibold text-alert" : "text-stamp")} title={`sharpness ${quality.sharp}, light ${quality.light}`}>
                  {quality.issue ? "Photo check: " : "Photo check ✓ "}{QUALITY_TEXT[quality.issue ?? "ok"].en}
                  {quality.issue ? ". The result below may be wrong." : ""}
                  <span className="block font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>{QUALITY_TEXT[quality.issue ?? "ok"].mr}</span>
                </p>
              )}
              <div className="flex items-center gap-3">
                <Confidence p={top.p} />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[18px] font-bold leading-tight", result.advice.tone === "alert" && "text-alert")}>{top.label}</p>
                  {mrLabel(top.label) ? <p className="text-[16px] leading-tight" style={{ fontFamily: "var(--font-anek-deva)" }}>{mrLabel(top.label)}</p> : null}
                  <p className="typed mt-0.5 text-[11.5px] text-ink-3">
                    {result.simulated ? "scripted demonstration" : `on-device, ${result.ms} ms · among ${CROPS.find((c) => c.id === result.crop)?.en.toLowerCase()} classes`}
                  </p>
                </div>
                <SourceStamp live={!result.simulated} label={result.simulated ? "Pomegranate result is scripted" : "Computed on this device"} />
              </div>
              {(lowConfidence || mismatch) && (
                <p className="mt-2 rounded-[2px] bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink">
                  {mismatch && rawTop ? `Across all 38 classes the model's first guess was ${rawTop.label} (${Math.round(rawTop.p * 100)}%); the result above is among ${CROPS.find((c) => c.id === result.crop)?.en.toLowerCase()} classes only. ` : ""}
                  {lowConfidence ? "Not sure: retake in daylight with one leaf filling the frame." : ""}
                  <span className="mt-1 block text-[14px]" style={{ fontFamily: "var(--font-anek-deva)" }}>
                    {mismatch ? "मॉडेलचा पहिला अंदाज दुसऱ्या पिकाचा होता; वरील निकाल निवडलेल्या पिकापुरता आहे. " : ""}
                    {lowConfidence ? "खात्री कमी: दिवसा उजेडात, एकच पान चौकट भरून पुन्हा फोटो घ्या." : ""}
                  </span>
                </p>
              )}
              {result.top.length > 1 && (
                <ol className="mt-2 space-y-0.5 text-[12.5px] text-ink-2">
                  {result.top.slice(1).map((r) => (
                    <li key={r.label} className="flex justify-between gap-2"><span>{r.label} <span style={{ fontFamily: "var(--font-anek-deva)" }}>{mrLabel(r.label)}</span></span><span className="typed">{Math.round(r.p * 100)}%</span></li>
                  ))}
                </ol>
              )}
              {result.heat && <p className="mt-2 text-[12px] text-ink-3">Red shows where hiding part of the leaf changed the model&apos;s answer most. <span style={{ fontFamily: "var(--font-anek-deva)" }}>लाल भाग: मॉडेलने जिथे पाहिले.</span></p>}
              <div className="perforated mt-3 bg-slip px-3.5 pb-3 pt-4">
                <p className="text-[15px] font-semibold leading-snug">{result.advice.en}</p>
                <p className="mt-1 text-[15px] leading-snug" style={{ fontFamily: "var(--font-anek-deva)" }}>{result.advice.mr}</p>
              </div>
              {result.simulated && (
                <button
                  type="button"
                  disabled={saved}
                  onClick={() => { heroScan({ confidence: top.p, offline: !online }); setSaved(true); }}
                  className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-[3px] bg-stamp text-[16px] font-bold text-paper disabled:bg-paper-3 disabled:text-ink-3"
                >
                  {saved ? <Stamp tone="stamp" size="sm" rotate={-4}>Saved to record</Stamp> : <>Save to my record <span className="font-normal" style={{ fontFamily: "var(--font-anek-deva)" }}>नोंदीत जतन करा</span></>}
                </button>
              )}
              {model.state === "error" && <p className="mt-2 text-[12px] text-alert">Model error: {model.error}</p>}
            </motion.section>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
