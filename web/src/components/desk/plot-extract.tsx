"use client";

import { Field, Ink, Sheet, SheetHead } from "@/components/record/sheet";
import { DatedImpression, SourceStamp, Stamp } from "@/components/record/stamp";
import { geo } from "@/lib/geo";
import { fmtDay } from "@/lib/sim/calendar";
import { STAGE_LABEL } from "@/lib/sim/rules";
import { blightStatus, plotHistory, stageOf } from "@/lib/sim/selectors";
import type { PlotEvent } from "@/lib/sim/types";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

function describe(e: PlotEvent): string {
  switch (e.type) {
    case "bahar": return e.note;
    case "irrigate": return `Irrigated ${(e.litres / 1000).toFixed(0)} kL`;
    case "irrigate-skip": return `Skipped irrigation: ${e.reason}, ${(e.litresSaved / 1000).toFixed(0)} kL saved`;
    case "scan": return e.finding === "bacterial-blight" ? `Leaf scan: bacterial blight, ${Math.round(e.confidence * 100)}%${e.offline ? " (offline)" : ""}` : "Leaf scan: healthy";
    case "spray": return `Sprayed ${e.product}, ${e.dose}${e.washedOff ? ". Washed off by rain" : ""}`;
    case "advisory": return e.text;
    case "voice": return `Asked: "${e.question}"`;
    case "pick": return `Picking ${e.picking}: ${e.crates} crates, grade ${e.grade}`;
    case "booking": return `Booked ${e.crates} crates on run ${e.run}`;
    case "sale": return `Sold ${e.crates} crates at ₹${e.pricePerKg}/kg, net ₹${Math.round(e.net).toLocaleString("en-IN")}`;
  }
}

export function PlotExtract({ className }: { className?: string }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const plotIndex = useDesk((s) => s.selectedPlot);
  const selectedHex = useDesk((s) => s.selectedHex);
  const selectPlot = useDesk((s) => s.selectPlot);
  const playing = useDesk((s) => s.playing);
  const day = Math.floor(t);
  const p = season.plots[plotIndex];
  const village = geo.villages[p.village];
  const stage = stageOf(season, plotIndex, day);
  const blight = blightStatus(season, plotIndex, day);
  const history = plotHistory(season, plotIndex, day).slice(-7).reverse();
  const inHex = selectedHex !== null ? season.plots.map((q, i) => ({ q, i })).filter(({ q }) => q.hex === selectedHex) : [];

  return (
    <Sheet className={cn("flex min-h-0 flex-col", className)}>
      <SheetHead
        form={p.id}
        title={p.farmer.name}
        mr={p.farmer.mr}
        right={
          <>
            <SourceStamp live={false} label="Synthetic farmer and plot" />
            <DatedImpression day={day} playing={playing} />
          </>
        }
      />
      {inHex.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-ink/15 bg-paper-2 px-4 py-2">
          <span className="label-form mr-1 text-ink-2">In this hex</span>
          {inHex.map(({ q, i }) => (
            <button
              key={q.id}
              type="button"
              onClick={() => selectPlot(i)}
              className={cn(
                "typed rounded-[2px] border px-1.5 py-0.5 text-[11px] transition-colors",
                i === plotIndex ? "border-stamp bg-stamp text-paper" : "border-ink/30 hover:border-ink",
              )}
            >
              {q.id}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-1">
        <Field n={1} label="Plot">
          Gat {p.gat}, {village.name} {village.mr}
        </Field>
        <Field n={2} label="Area · water">
          {p.acres.toFixed(2)} ac, {p.drip ? "drip" : "flood"}, {p.soil}
        </Field>
        <Field n={3} label="Crop">
          Pomegranate, Bhagwa, Mrig bahar from {fmtDay(p.baharStart)}
        </Field>
        <Field n={4} label="Stage today">
          {STAGE_LABEL[stage].en} {STAGE_LABEL[stage].mr}
        </Field>
        <Field n={5} label="Blight">
          <span className={cn(blight.tone === "alert" && "font-bold text-alert", blight.tone === "stamp" && "font-bold text-stamp")}>{blight.label}</span>
        </Field>
        <Field n={6} label="Harvest">
          First picking {fmtDay(p.harvestStart)}, about {Math.round((p.expectedTonnes * 1000) / 20)} crates
        </Field>
        <Field n={7} label="Records by">
          {p.farmer.usesApp ? "Farmer, on the KhetKundli phone" : "Village agent, for the farmer"}
        </Field>
        <p className="label-form mt-3 text-ink-2">Recent entries</p>
        <ol className="mt-1">
          {history.length === 0 ? <li className="text-[13px] text-ink-3">No entries yet this season.</li> : null}
          {history.map((e) => (
            <li key={e.id} className="grid grid-cols-[3.4rem_1fr] gap-2 border-b border-dotted border-ink/20 py-1 text-[13px] leading-snug">
              <span className="typed text-[11px] text-ink-3">{fmtDay(e.day)}</span>
              <span className={cn((e.type === "scan" && e.finding === "bacterial-blight") || (e.type === "spray" && e.washedOff) ? "[&_*]:!text-alert" : "")}>
                <Ink by={e.by}>{describe(e)}</Ink>
                {e.by === "verified" ? <Stamp size="xs" rotate={-4} press={false} className="ml-2 align-middle">Verified</Stamp> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Sheet>
  );
}
