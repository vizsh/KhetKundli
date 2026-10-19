"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Sheet, SheetHead } from "@/components/record/sheet";
import { SourceStamp, Stamp } from "@/components/record/stamp";
import { StampButton } from "@/components/record/stamp-button";
import { mrDay } from "@/lib/farmer";
import { routeByHub, geo } from "@/lib/geo";
import { dateOf, fmtDay, SEASON_DAYS } from "@/lib/sim/calendar";
import { COMMISSION, CRATE_KG, GRADE_FACTOR, HAMALI_PER_CRATE, markets, WEIGHMENT_PER_CRATE } from "@/lib/sim/rules";
import type { MarketId, PlotEvent } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const IDS: MarketId[] = ["phaltan", "pune", "vashi"];
const SPAN = 7;
const WAVE = ["var(--wave-0)", "var(--wave-1)", "var(--wave-2)", "var(--wave-3)", "var(--wave-4)"];
const MR = { fontFamily: "var(--font-anek-deva)" } as const;

type LivePrices = { status: string; markets: Partial<Record<MarketId, { market: string; date: string; modalPerKg: number }>> };

/** Today's real mandi prices when an Agmarknet key is configured; otherwise nothing is shown as live. */
function useLivePrices() {
  const [live, setLive] = useState<LivePrices | null>(null);
  useEffect(() => {
    let off = false;
    fetch("/api/prices").then((r) => r.json()).then((j: LivePrices) => !off && setLive(j)).catch(() => !off && setLive({ status: "unavailable", markets: {} }));
    return () => { off = true; };
  }, []);
  return live;
}

/** Fifteen ruled days around the planned picking, shaded by how many crates the village picks each day. */
function DateStrip({ planned, shift, setShift, villageDaily }: { planned: number; shift: number; setShift: (s: number) => void; villageDaily: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...villageDaily);
  const fromPointer = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const k = Math.round(((clientX - r.left) / r.width) * (2 * SPAN + 1) - 0.5) - SPAN;
    setShift(Math.max(-SPAN, Math.min(SPAN, k)));
  };
  return (
    <div>
      <div
        ref={ref}
        aria-hidden
        className="relative grid h-16 cursor-pointer touch-none select-none border-y-2 border-ink"
        style={{ gridTemplateColumns: `repeat(${2 * SPAN + 1}, minmax(0, 1fr))` }}
        onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); fromPointer(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) fromPointer(e.clientX); }}
      >
        {villageDaily.map((c, i) => {
          const day = planned - SPAN + i;
          const k = c ? Math.min(4, 1 + Math.floor((c / max) * 3.99)) : 0;
          return (
            <div key={i} className={cn("relative flex flex-col items-center justify-between border-r border-ink/20 pb-1 pt-1 last:border-r-0", i === SPAN && "bg-paper-2")}>
              <span className={cn("typed text-[11px] leading-none", i === SPAN + shift ? "font-bold text-stamp" : "text-ink-2")}>{dateOf(day).d}</span>
              <span className="h-6 w-full" style={{ background: WAVE[k] }} />
            </div>
          );
        })}
        <div
          className="pointer-events-none absolute -bottom-1.5 top-[18px] w-[3px] bg-stamp transition-[left] duration-150 ease-out"
          style={{ left: `calc(${((shift + SPAN + 0.5) / (2 * SPAN + 1)) * 100}% - 1.5px)` }}
        >
          <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-stamp" />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] leading-tight text-ink-3">
        <span>7 days earlier <span style={MR}>७ दिवस आधी</span></span>
        <span className="text-right">7 days later <span style={MR}>७ दिवस नंतर</span></span>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-3">
        Shading: crates the village picks that day <span style={MR}>गावातील त्या दिवसाची तोडणी</span>
      </p>
    </div>
  );
}

export function HarvestDate({ plot }: { plot: number }) {
  const season = useDesk((s) => s.season);
  const overrides = useDesk((s) => s.overrides);
  const heroHarvest = useDesk((s) => s.heroHarvest);
  const live = useLivePrices();
  const p = season.plots[plot];
  const planned = p.harvestStart - (overrides.heroPickShift ?? 0);
  const confirmed = overrides.heroPickShift !== undefined && overrides.heroMarket !== undefined;
  const [shift, setShift] = useState(overrides.heroPickShift ?? 0);
  const [market, setMarket] = useState<MarketId | null>(overrides.heroMarket ?? null);

  const village = geo.villages[p.village];
  const hubKm = routeByHub.get(village.hub)?.km ?? 15;
  const mk = markets(hubKm);
  const grade = (season.eventsByPlot[plot].find((e) => e.type === "pick") as Extract<PlotEvent, { type: "pick" }> | undefined)?.grade ?? "A";
  const pickDay = Math.max(0, Math.min(SEASON_DAYS - 2, planned + shift));
  const saleDay = pickDay + 1;

  const villageDaily = useMemo(() => {
    const out = Array.from({ length: 2 * SPAN + 1 }, () => 0);
    season.plots.forEach((q, i) => {
      if (q.village !== p.village) return;
      for (const e of season.eventsByPlot[i]) {
        if (e.type !== "pick") continue;
        const k = e.day - (planned - SPAN);
        if (k >= 0 && k < out.length) out[k] += e.crates;
      }
    });
    return out;
  }, [season, p.village, planned]);

  const options = useMemo(() => IDS.map((id) => {
    const price = Math.round(season.prices[id][saleDay] * GRADE_FACTOR[grade]);
    const net = Math.round(price * CRATE_KG * (1 - COMMISSION) - mk[id].freightPerCrate - HAMALI_PER_CRATE - WEIGHMENT_PER_CRATE);
    // A glut is a local spike in arrivals, not the season's broad harvest rise: compare with the days either side.
    const arrivals = season.arrivals[id];
    const around = (arrivals[Math.max(0, saleDay - 12)] + arrivals[Math.min(SEASON_DAYS - 1, saleDay + 12)]) / 2;
    return { id, price, net, glut: arrivals[saleDay] > around * 1.25 };
  }), [season, saleDay, grade, mk]);
  const best = options.reduce((a, b) => (b.net > a.net ? b : a));
  const chosen = market ?? best.id;
  const current = confirmed && shift === overrides.heroPickShift && chosen === overrides.heroMarket;

  return (
    <Sheet>
      <SheetHead form="KK-5" title="Picking date and market" mr="तोडणी आणि विक्री" right={<SourceStamp live={false} label="Prices are simulated until an Agmarknet key is set" />} />
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] text-ink-2">First picking <span style={MR}>पहिली तोडणी</span></p>
          <p className="typed text-[12px] text-ink-3">planned {fmtDay(planned)}</p>
        </div>
        <p className="mt-0.5 text-[26px] font-bold leading-tight [font-stretch:85%]">
          {fmtDay(pickDay)} <span className="text-[18px] font-normal text-ink-2" style={MR}>{mrDay(pickDay)}</span>
        </p>
        <div className="mt-2">
          <DateStrip planned={planned} shift={shift} setShift={setShift} villageDaily={villageDaily} />
          <input
            type="range"
            min={-SPAN}
            max={SPAN}
            step={1}
            value={shift}
            onChange={(e) => setShift(Number(e.target.value))}
            aria-label="Move first picking earlier or later"
            aria-valuetext={`${fmtDay(pickDay)}, ${shift === 0 ? "as planned" : `${Math.abs(shift)} days ${shift < 0 ? "earlier" : "later"}`}`}
            className="sr-only"
          />
        </div>

        <ol className="mt-4 border-t-2 border-ink" role="radiogroup" aria-label="Market">
          {options.map((o, i) => (
            <li key={o.id} className="border-b border-ink/25">
              <button
                type="button"
                role="radio"
                aria-checked={chosen === o.id}
                onClick={() => setMarket(o.id)}
                className={cn("grid min-h-16 w-full grid-cols-[1.4rem_1fr_auto] items-center gap-2 px-1 py-2 text-left transition-colors hover:bg-paper-2", chosen === o.id && "bg-paper-2")}
                style={o.glut ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in oklab, var(--alert) 22%, transparent) 7px 8.5px)" } : undefined}
              >
                <span className="typed text-[12px] text-ink-3">{i + 1}.</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-tight">{mk[o.id].name}</span>
                  <span className="block text-[14px] leading-tight text-ink-2" style={MR}>{mk[o.id].mr}</span>
                  <span className="typed block whitespace-nowrap text-[11.5px] text-ink-3">₹{o.price}/kg · {grade} · fr ₹{mk[o.id].freightPerCrate}</span>
                  {o.glut && <span className="mt-0.5 block text-[12px] font-semibold text-alert">Glut that day <span style={MR}>त्या दिवशी आवक जास्त</span></span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-right">
                    <span className="typed block text-[19px] font-bold leading-none">₹{o.net}</span>
                    <span className="block whitespace-nowrap text-[11px] text-ink-3">/crate · <span style={MR}>/क्रेट</span></span>
                  </span>
                  <span className={cn("grid size-7 place-items-center rounded-[2px] border-2", chosen === o.id ? "border-stamp bg-stamp text-paper" : "border-ink/30 text-transparent")}>
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12px] leading-snug text-ink-3">
          Net after 6% commission, pooled freight, loading and weighment. <span style={MR}>कमिशन, वाहतूक, हमाली आणि वजनकाटा वजा करून.</span>
        </p>
        {live?.status === "live" ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-[2px] bg-paper-2 px-2.5 py-1.5 text-[12.5px]">
            <span>
              Mandi today <span style={MR}>आजचा भाव</span>:{" "}
              {IDS.filter((id) => live.markets[id]).map((id) => `${mk[id].name.split(" ")[0]} ₹${Math.round(live.markets[id]!.modalPerKg)}/kg`).join(" · ")}
            </span>
            <SourceStamp live label={`Agmarknet modal price, ${Object.values(live.markets)[0]?.date ?? ""}`} />
          </div>
        ) : null}
        <div className="mt-4 flex min-h-16 items-center justify-center">
          {current ? (
            <Stamp tone="stamp" size="lg" rotate={-3}>
              Confirmed {fmtDay(pickDay)} · {mk[chosen].name.split(" ")[0]} <span className="ml-2 normal-case" style={MR}>निश्चित</span>
            </Stamp>
          ) : (
            <StampButton tone="stamp" onClick={() => heroHarvest(shift, chosen)} className="min-h-14 w-full">
              <span className="text-[16px] font-bold">Confirm {fmtDay(pickDay)} · {mk[chosen].name}</span>
              <span className="text-[15px]" style={MR}>निश्चित करा</span>
            </StampButton>
          )}
        </div>
        {current ? (
          <p className="mt-1 text-center text-[12px] text-ink-3">
            Sent to the desk; pooled runs re-planned. <span style={MR}>डेस्ककडे पाठवले; सामायिक गाड्यांचे नियोजन बदलले.</span>
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
