"use client";

import Link from "next/link";
import { Sheet } from "@/components/record/sheet";
import { useDesk } from "@/lib/store";
import { SyncBridge } from "@/lib/sync";
import { DateStamp, SeasonPlayer, SeasonTrack } from "./date-stamp";
import { FigureSheet } from "./figure-sheet";
import { LayerTabs } from "./layer-tabs";
import { DemoSlip, MapCartouche, MapLegend } from "./map-furniture";
import { PlotExtract } from "./plot-extract";
import { Register } from "./register";
import { SurveyMap } from "./survey-map";
import { VillageLedger } from "./village-ledger";
import { LiveWeatherLoader, WeatherSlip } from "./weather-slip";

function FileCover() {
  const plots = useDesk((s) => s.season.plots.length);
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-3 pb-2 pt-3 sm:px-5">
      <Link href="/" className="group min-w-0">
        <p className="flex items-baseline gap-2 leading-none">
          <span className="text-[26px] font-bold tracking-[-0.01em] text-board-ink [font-stretch:80%]">KhetKundli</span>
          <span className="font-marathi text-[19px] text-board-ink-2">खेतकुंडली</span>
        </p>
        <p className="mt-1 text-[12.5px] text-board-ink-2">
          Phaltan taluka · pomegranate, Mrig bahar 2026 · <span className="typed">{plots}</span> plots on record
        </p>
      </Link>
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto lg:ml-auto lg:gap-4">
        <div className="hidden w-[420px] lg:block">
          <SeasonTrack />
        </div>
        <DateStamp />
        <WeatherSlip />
      </div>
    </header>
  );
}

export function Desk() {
  return (
    <div className="flex min-h-dvh flex-col xl:h-dvh xl:overflow-hidden">
      <SeasonPlayer />
      <LiveWeatherLoader />
      <SyncBridge />
      <FileCover />
      <main className="grid min-h-0 flex-1 grid-cols-1 content-start gap-5 px-3 pb-5 sm:px-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(400px,1fr)] xl:content-normal">
        <div className="flex min-h-0 min-w-0 flex-col">
          <LayerTabs />
          <Sheet className="flex min-h-0 flex-1 flex-col">
            <div className="relative shrink-0">
              <SurveyMap />
              <MapCartouche />
              <div className="slip-shadow absolute right-20 top-3 hidden xl:block">
                <DemoSlip floating />
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 border-t-2 border-ink px-4 py-2">
              <MapLegend />
              <div className="xl:hidden">
                <DemoSlip />
              </div>
            </div>
            <VillageLedger className="h-72 border-t-2 border-ink xl:h-auto xl:flex-1" />
            <p className="typed border-t border-ink/15 px-4 py-1 text-[11px] text-ink-3">
              Map data © OpenStreetMap contributors (ODbL). Village areas are approximate (Voronoi from village points). Plots and events are simulated.
            </p>
          </Sheet>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <FigureSheet />
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-rows-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <Register className="min-h-[260px]" />
            <PlotExtract className="min-h-[260px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
