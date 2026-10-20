"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LiveWeatherLoader } from "@/components/desk/weather-slip";
import { Qr } from "@/components/record/qr";
import { Field, Ink, Sheet, SheetHead } from "@/components/record/sheet";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { mrDay } from "@/lib/farmer";
import { passportFor } from "@/lib/lot";
import { fmtDay } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import { SyncBridge } from "@/lib/sync";
import { cn } from "@/lib/utils";

const MR = { fontFamily: "var(--font-anek-deva)" } as const;
const MARKET = { phaltan: "Phaltan APMC", pune: "Pune market yard", vashi: "Vashi APMC" } as const;
const FINDING = { "bacterial-blight": "bacterial blight", healthy: "healthy", anthracnose: "anthracnose" } as const;

/** The page's own address, read on the client (the QR must point at the host the buyer can reach). */
const useHref = () => useSyncExternalStore(() => () => {}, () => window.location.href, () => "");

/** One picking's record for a buyer or an exporter: origin, sprays, water, and the export pre-harvest check. */
export function LotPassport() {
  const { id } = useParams<{ id: string }>();
  const season = useDesk((s) => s.season);
  const today = useDesk((s) => s.today);
  const href = useHref();
  const lot = passportFor(season, id);

  return (
    <div className="min-h-dvh px-3 pb-10 pt-4">
      <LiveWeatherLoader />
      <SyncBridge listenOnly />
      <div className="mx-auto max-w-[560px]">
        <p className="mb-2 flex items-baseline justify-between px-1">
          <Link href="/" className="text-[20px] font-bold text-board-ink [font-stretch:80%]">KhetKundli <span className="font-marathi text-[16px] font-normal text-board-ink-2">खेतकुंडली</span></Link>
          <span className="typed text-[11px] text-board-ink-2">lot passport · लॉट पासपोर्ट</span>
        </p>
        {!lot ? (
          <Sheet className="px-5 py-6">
            <p className="text-[16px] font-semibold">No lot with the number {decodeURIComponent(id)}.</p>
            <p className="mt-1 text-[13px] text-ink-2">Lot numbers look like TAR-214-P1: the plot, then the picking.</p>
          </Sheet>
        ) : (
          <Sheet>
            <SheetHead form="KK-9" title="Lot passport" mr="लॉट पासपोर्ट" right={<SourceStamp live={false} label="Built from a synthetic plot record" />} />
            <div className="flex items-start justify-between gap-4 border-b border-ink/20 px-4 py-3">
              <div className="min-w-0">
                <p className="typed text-[26px] font-bold leading-none tracking-tight">{lot.id}</p>
                <p className="mt-1.5 text-[14px] leading-snug">
                  {lot.pick.crates} crates · grade {lot.pick.grade} · picked {fmtDay(lot.pick.day)}
                  <span className="block text-ink-2" style={MR}>{lot.pick.crates} क्रेट · {mrDay(lot.pick.day)}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lot.pick.day > today ? <Stamp tone="ink" size="xs" rotate={-3} press={false}>Planned</Stamp> : <Stamp tone="stamp" size="xs" rotate={-3} press={false}>Picked</Stamp>}
                  {lot.exportCheck.eligible ? (
                    <Stamp tone="stamp" size="xs" rotate={3} press={false}>Export PHI clear</Stamp>
                  ) : (
                    <Stamp tone="alert" size="xs" rotate={3} press={false}>Not for export</Stamp>
                  )}
                </div>
              </div>
              {href && (
                <div className="flex flex-col items-center gap-1">
                  <Qr value={href} size={112} label={`QR code for lot ${lot.id}`} />
                  <span className="typed text-[9.5px] text-ink-3">scan to open</span>
                </div>
              )}
            </div>
            <div className="px-4 py-2">
              <Field n={1} label="Origin">{lot.village} <span style={MR}>{lot.villageMr}</span>, Phaltan taluka · cell {lot.cell}</Field>
              <Field n={2} label="Grower">{lot.grower}, {lot.acres} ac on {lot.drip ? "drip" : "flood"} irrigation</Field>
              <Field n={3} label="Crop">Pomegranate, Bhagwa · Mrig bahar{lot.baharDay !== undefined ? ` from ${fmtDay(lot.baharDay)}` : ""}</Field>
              <Field n={4} label="Transport">{lot.run ? `Pooled run ${lot.run.id}, ${lot.run.hub} collection point → ${MARKET[lot.run.market]}` : "Not booked"}</Field>
              <Field n={5} label="Water">{lot.waterKl.toLocaleString("en-IN")} kL by drip · {lot.savedKl.toLocaleString("en-IN")} kL skipped before rain</Field>
              <Field n={6} label="Leaf scans">
                {lot.scans.length ? lot.scans.map((s, i) => (
                  <span key={i} className={cn("block", s.finding === "bacterial-blight" && "text-alert")}><Ink by={s.by}>{fmtDay(s.day)}: {FINDING[s.finding as keyof typeof FINDING] ?? s.finding}</Ink></span>
                )) : "None recorded"}
              </Field>
              <Field n={7} label="Sprays">
                {lot.sprays.length ? lot.sprays.map((s, i) => (
                  <span key={i} className={cn("block", s.washedOff && "text-alert")}><Ink by={s.by}>{fmtDay(s.day)}: {s.product}{s.washedOff ? ", washed off by rain" : ""}</Ink></span>
                )) : "None recorded"}
              </Field>
            </div>
            <div className={cn("perforated mx-4 mb-4 mt-1 px-3.5 pb-3 pt-4", lot.exportCheck.eligible ? "bg-slip" : "bg-[color-mix(in_oklab,var(--alert)_10%,var(--slip))]")}>
              <p className="label-form text-ink-2">Export check · pre-harvest interval</p>
              {lot.exportCheck.eligible ? (
                <p className="mt-1 text-[14.5px] font-semibold leading-snug">No copper spray in the {lot.exportCheck.phi} days before picking. A residue test is still needed before export.</p>
              ) : (
                <p className="mt-1 text-[14.5px] font-semibold leading-snug text-alert">
                  {lot.exportCheck.blocking!.product} on {fmtDay(lot.exportCheck.blocking!.day)}, {lot.exportCheck.blocking!.gap} days before picking. The APEDA list asks {lot.exportCheck.phi} days for copper. Sell this lot in the domestic market; a picking from {fmtDay(lot.exportCheck.clearsOn!)} would clear it.
                </p>
              )}
              <p className="mt-1 text-[13.5px] leading-snug" style={MR}>
                {lot.exportCheck.eligible ? "काढणीपूर्वी ६० दिवसांत तांब्याची फवारणी नाही; निर्यातीपूर्वी अवशेष चाचणी आवश्यक." : "काढणीपूर्वी ६० दिवसांच्या आत तांब्याची फवारणी झाली आहे: हा लॉट देशांतर्गत बाजारात विका."}
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-3">Interval from the APEDA pomegranate list for copper compounds (see docs/AGRONOMY.md). Not a certificate: export registration and residue testing go through APEDA&apos;s AnarNet.</p>
            </div>
          </Sheet>
        )}
        <p className="mt-3 px-1 text-center text-[11.5px] leading-snug text-board-ink-2">
          Built from the plot&apos;s record: village and cell only, no gat number, no full name. Synthetic plot for the Phaltan Hackathon demo.
        </p>
      </div>
    </div>
  );
}
