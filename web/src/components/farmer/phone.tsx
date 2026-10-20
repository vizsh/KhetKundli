"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Mic, ScanLine } from "lucide-react";
import { SeasonPlayer } from "@/components/desk/date-stamp";
import { LiveWindLoader } from "@/components/desk/forecast";
import { LiveWeatherLoader } from "@/components/desk/weather-slip";
import { Sheet } from "@/components/record/sheet";
import { DatedImpression, SourceStamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { geo } from "@/lib/geo";
import { useDesk } from "@/lib/store";
import { SyncBridge } from "@/lib/sync";
import { AskSheet } from "./ask-sheet";
import { HarvestDate } from "./harvest-date";
import { LotPassports } from "./lot-passports";
import { NeighbourPulse } from "./neighbour-pulse";
import { Passbook } from "./passbook";
import { ScanLens } from "./scan-lens";
import { SlipCheck } from "./slip-check";
import { SeasonWheel, WheelKey } from "./season-wheel";
import { TodaySlip } from "./today-slip";

export function Phone() {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const playing = useDesk((s) => s.playing);
  const liveStatus = useDesk((s) => s.liveStatus);
  const plot = season.heroPlot;
  const p = season.plots[plot];
  const village = geo.villages[p.village];
  const [scan, setScan] = useState(false);
  const [ask, setAsk] = useState(false);
  const [slip, setSlip] = useState(false);
  const [hint, setHint] = useState(true);

  // Offline support ships in production builds only, so development never serves stale files.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-dvh">
      <SeasonPlayer />
      <LiveWeatherLoader />
      <LiveWindLoader />
      <SyncBridge />
      <div className="mx-auto max-w-[480px] px-3 pb-36 pt-2.5">
        <header className="px-1 pb-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex min-w-0 items-baseline gap-2 leading-tight">
              <span className="truncate text-[22px] font-bold text-board-ink [font-stretch:82%]">{p.farmer.name}</span>
              <span className="whitespace-nowrap font-marathi text-[18px] text-board-ink-2">{p.farmer.mr}</span>
            </p>
            <DatedImpression day={Math.floor(t)} playing={playing} size="sm" />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="typed truncate text-[12px] text-board-ink-2">Gat {p.gat} · {village.name} · {p.acres} ac</p>
            <div className="flex shrink-0 gap-1.5">
              <SourceStamp size="sm" live={liveStatus === "live"} label={liveStatus === "live" ? "Weather is live from Open-Meteo" : "Weather is simulated"} />
              <SourceStamp size="sm" live={false} label="Plot record is synthetic" />
            </div>
          </div>
        </header>

        <Sheet className="px-2 pb-2.5 pt-1.5">
          <div className="mx-auto" style={{ maxWidth: "min(328px, max(260px, calc(100dvh - 516px)))" }}>
            <SeasonWheel plot={plot} onScrub={() => setHint(false)} />
          </div>
          <WheelKey />
          <AnimatePresence initial={false}>
            {hint && (
              <motion.p
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-1 text-center text-[12px] text-ink-3"
              >
                Drag the violet dot round the wheel to move through the season.{" "}
                <span style={{ fontFamily: "var(--font-anek-deva)" }}>हंगाम पाहण्यासाठी जांभळा ठिपका फिरवा.</span>
              </motion.p>
            )}
          </AnimatePresence>
        </Sheet>

        <div className="mt-3.5">
          <TodaySlip plot={plot} />
        </div>

        <div className="mt-4">
          <NeighbourPulse plot={plot} />
        </div>

        <div className="mt-4">
          <HarvestDate plot={plot} />
        </div>

        <div className="mt-4">
          <LotPassports plot={plot} />
        </div>

        <div className="mt-4">
          <Passbook plot={plot} onCheckSlip={() => setSlip(true)} />
        </div>

        <p className="mt-4 px-1 text-center text-[12px] text-board-ink-2">
          Synthetic farmer and plot for the Phaltan Hackathon demo.{" "}
          <span style={{ fontFamily: "var(--font-anek-deva)" }}>प्रात्यक्षिकासाठी काल्पनिक शेतकरी.</span>{" "}
          <Link href="/desk" className="font-semibold underline">Open the Taluka Desk</Link>
        </p>
      </div>

      <nav
        aria-label="Actions"
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-board-edge bg-board-deep px-4 pb-4 pt-3.5"
      >
        <div className="flex gap-4">
          <StampButton onClick={() => setScan(true)} className="min-h-16 flex-1">
            <ScanLine className="size-6" />
            <span className="text-left leading-tight">
              <span className="block text-[17px] font-bold">Scan a leaf</span>
              <span className="block text-[14px] opacity-90" style={{ fontFamily: "var(--font-anek-deva)" }}>पान स्कॅन करा</span>
            </span>
          </StampButton>
          <StampButton tone="stamp" onClick={() => setAsk(true)} className="min-h-16 flex-1">
            <Mic className="size-6" />
            <span className="text-left leading-tight">
              <span className="block text-[17px] font-bold">Ask</span>
              <span className="block text-[14px] opacity-90" style={{ fontFamily: "var(--font-anek-deva)" }}>प्रश्न विचारा</span>
            </span>
          </StampButton>
        </div>
      </nav>

      <ScanLens open={scan} onClose={() => setScan(false)} />
      <AskSheet open={ask} onClose={() => setAsk(false)} plot={plot} />
      <SlipCheck open={slip} onClose={() => setSlip(false)} plot={plot} />
    </div>
  );
}
