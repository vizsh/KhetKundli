"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { SourceStamp } from "@/components/record/stamp";
import { geo } from "@/lib/geo";
import { villageCrates, waterShareByVillage, focusWeek } from "@/lib/sim/selectors";
import { fmtDay, weekStart } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const RISK = ["Clear", "Watch", "Warning", "Outbreak"];
const ROW = 30;
const HEAD = 34;

/** One ruled row per village; the active layer decides the measure and the sort. */
export function VillageLedger({ className }: { className?: string }) {
  const season = useDesk((s) => s.season);
  const layer = useDesk((s) => s.layer);
  const t = useDesk((s) => s.t);
  const waveWeek = useDesk((s) => s.waveWeek);
  const selectPlot = useDesk((s) => s.selectPlot);
  const selectHex = useDesk((s) => s.selectHex);
  const selectedPlot = useDesk((s) => s.selectedPlot);
  const day = Math.floor(t);
  const week = focusWeek(season, day, waveWeek);

  // Size the box to a whole number of rows so no row is ever cut in half.
  const outer = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ rows: number; rowH: number } | null>(null);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const space = entry.contentRect.height - HEAD;
      const rows = Math.max(2, Math.floor(space / ROW));
      setFit({ rows, rowH: Math.max(ROW, space / rows) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const crates = villageCrates(season, week);
    const { saved } = waterShareByVillage(season, day);
    const risk = season.hexRisk[day];
    const out = geo.villages.map((v, i) => {
      const plots = season.plots.map((p, k) => ({ p, k })).filter(({ p }) => p.village === i);
      const hexes = geo.hexes.map((h, k) => ({ h, k })).filter(({ h }) => h.village === i);
      const worst = hexes.reduce((m, { k }) => Math.max(m, risk[k]), 0);
      const flagged = hexes.filter(({ k }) => risk[k] >= 1).length;
      return { v, i, plots, worst, flagged, crates: crates[i], saved: saved[i] / 1e6, hub: geo.villages.find((x) => x.id === v.hub)?.name ?? "" };
    });
    const by: Record<string, (a: (typeof out)[number], b: (typeof out)[number]) => number> = {
      pest: (a, b) => b.worst - a.worst || b.flagged - a.flagged,
      wave: (a, b) => b.crates - a.crates,
      water: (a, b) => b.saved - a.saved,
      runs: (a, b) => a.hub.localeCompare(b.hub) || b.crates - a.crates,
    };
    return out.filter((r) => r.plots.length).sort(by[layer]);
  }, [season, day, week, layer]);

  const measure = {
    pest: "Blight",
    wave: `Crates, week of ${fmtDay(weekStart(week))}`,
    water: "Water saved",
    runs: "Collection point",
  }[layer];
  const selectedVillage = season.plots[selectedPlot]?.village;

  return (
    <div ref={outer} className={cn("min-h-0", className)}>
      <div className="overflow-y-auto" style={fit ? { maxHeight: HEAD + fit.rows * fit.rowH } : undefined}>
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-paper">
            <tr className="border-b-2 border-ink text-left" style={{ height: HEAD }}>
              <th className="label-form pl-4 pr-2 font-semibold text-ink-2">Village</th>
              <th className="label-form px-2 text-right font-semibold text-ink-2">Plots</th>
              <th className="label-form px-2 font-semibold text-ink">{measure}</th>
              <th className="pr-4 text-right"><SourceStamp live={false} /></th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr
                key={r.v.id}
                style={{ height: fit?.rowH ?? ROW }}
                onClick={() => { selectPlot(r.plots[0].k); selectHex(r.plots[0].p.hex); }}
                className={cn(
                  "cursor-pointer border-b border-dotted border-ink/25 transition-colors hover:bg-paper-2",
                  r.i === selectedVillage && "bg-[color-mix(in_oklab,var(--stamp)_9%,var(--paper))]",
                )}
              >
                <td className="pl-4 pr-2">
                  <span className="font-semibold">{r.v.name}</span>{" "}
                  <span className="whitespace-nowrap text-ink-2" style={{ fontFamily: "var(--font-anek-deva)" }}>{r.v.mr}</span>
                </td>
                <td className="typed px-2 text-right">{r.plots.length}</td>
                <td colSpan={2} className="whitespace-nowrap px-2 pr-4">
                  {layer === "pest" && (
                    <span className={cn("typed", r.worst >= 2 && "font-bold text-alert")}>
                      {RISK[r.worst]}
                      {r.flagged ? `, ${r.flagged} ${r.flagged === 1 ? "hex" : "hexes"}` : ""}
                    </span>
                  )}
                  {layer === "wave" && <span className="typed">{r.crates ? r.crates.toLocaleString("en-IN") : "none due"}</span>}
                  {layer === "water" && <span className="typed">{r.saved ? `${r.saved.toFixed(2)} ML` : "none yet"}</span>}
                  {layer === "runs" && <span className="typed">{r.hub}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
