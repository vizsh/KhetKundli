"use client";

import { CloudRain, RotateCcw, ScanLine, Smartphone } from "lucide-react";
import { geo } from "@/lib/geo";
import { useDesk } from "@/lib/store";

function Swatch({ kind }: { kind: "river" | "canal" | "road" | "rail" | "boundary" | "hub" | "apmc" }) {
  return (
    <svg width="26" height="12" aria-hidden className="shrink-0">
      {kind === "river" && <line x1="1" x2="25" y1="6" y2="6" stroke="var(--water)" strokeWidth="2.4" strokeLinecap="round" />}
      {kind === "canal" && <line x1="1" x2="25" y1="6" y2="6" stroke="var(--canal)" strokeWidth="1" strokeDasharray="5 2" />}
      {kind === "road" && <line x1="1" x2="25" y1="6" y2="6" stroke="var(--ink)" strokeWidth="1.5" />}
      {kind === "rail" && (
        <>
          <line x1="1" x2="25" y1="6" y2="6" stroke="var(--ink)" strokeWidth="2.6" />
          <line x1="1" x2="25" y1="6" y2="6" stroke="var(--paper)" strokeWidth="1.4" strokeDasharray="5 5" />
        </>
      )}
      {kind === "boundary" && <line x1="1" x2="25" y1="6" y2="6" stroke="var(--ink)" strokeWidth="2" strokeDasharray="8 3 2 3" />}
      {kind === "hub" && <rect x="9" y="2" width="8" height="8" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />}
      {kind === "apmc" && (
        <>
          <circle cx="13" cy="6" r="5" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
          <circle cx="13" cy="6" r="2" fill="var(--ink)" />
        </>
      )}
    </svg>
  );
}

export function MapLegend() {
  const layer = useDesk((s) => s.layer);
  const items: [Parameters<typeof Swatch>[0]["kind"], string][] = [
    ["river", "Nira and Karha rivers"],
    ["canal", "Nira canals"],
    ["road", "National and state highways"],
    ["rail", "Lonand–Phaltan–Baramati railway"],
    ["boundary", "Taluka boundary"],
    ...(layer === "runs" ? [["hub", "Village collection point"] as [Parameters<typeof Swatch>[0]["kind"], string]] : []),
    ["apmc", `${geo.apmc.name} (approx. location)`],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
      {items.map(([k, label]) => (
        <span key={k} className="flex items-center gap-1.5">
          <Swatch kind={k} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function MapCartouche() {
  return (
    <div className="pointer-events-none absolute left-4 top-4 hidden border-2 border-ink bg-paper/90 px-3 py-1.5 sm:block">
      <p className="text-[13px] font-bold uppercase tracking-[0.12em] [font-stretch:85%]">Phaltan taluka</p>
      <p className="font-marathi text-[14px] leading-tight">फलटण तालुका, जि. सातारा</p>
      <p className="typed mt-0.5 text-[9.5px] text-ink-3">SURVEY SHEET · H3 GRID, RES 7</p>
    </div>
  );
}

export function DemoSlip({ floating = false }: { floating?: boolean }) {
  const heroScan = useDesk((s) => s.heroScan);
  const rainTwist = useDesk((s) => s.rainTwist);
  const resetDemo = useDesk((s) => s.resetDemo);
  const overrides = useDesk((s) => s.overrides);
  const scanned = (overrides.scans?.length ?? 0) > 0;
  const rained = Boolean(overrides.rain);
  const btn =
    "inline-flex items-center gap-1.5 rounded-[3px] border-2 border-ink px-2.5 py-1 text-[12.5px] font-semibold transition-[background-color,transform] hover:bg-ink hover:text-paper active:translate-y-px disabled:cursor-not-allowed disabled:border-ink/30 disabled:text-ink-3 disabled:hover:bg-transparent disabled:hover:text-ink-3";
  return (
    <div className={floating ? "perforated flex flex-col gap-1.5 bg-slip px-3 pb-2 pt-3 shadow-[var(--shadow-lift)]" : "flex flex-wrap items-center gap-2"}>
      <span className="label-form mr-1 text-ink-3">Demo inputs, simulated</span>
      <div className={floating ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-center gap-2"}>
      <button type="button" className={btn} onClick={() => heroScan()} disabled={scanned}>
        <ScanLine className="size-3.5" strokeWidth={2.25} />
        Sunita scans a leaf, offline
      </button>
      <button type="button" className={btn} onClick={rainTwist} disabled={rained}>
        <CloudRain className="size-3.5" strokeWidth={2.25} />
        Rain forecast in 18 h
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => window.open("/farmer", "sunita-phone", "popup,width=430,height=900")}
        title="Opens the farmer phone in its own window; scans there ripple here"
      >
        <Smartphone className="size-3.5" strokeWidth={2.25} />
        Open Sunita&rsquo;s phone
      </button>
      <button type="button" className={`${btn} border-transparent`} onClick={resetDemo} disabled={!scanned && !rained}>
        <RotateCcw className="size-3.5" strokeWidth={2.25} />
        Reset
      </button>
      </div>
    </div>
  );
}
