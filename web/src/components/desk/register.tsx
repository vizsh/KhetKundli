"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Ink, InkKey, Sheet, SheetHead } from "@/components/record/sheet";
import { DatedImpression, SourceStamp, Stamp } from "@/components/record/stamp";
import { registerFor } from "@/lib/sim/selectors";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

function RippleSlip() {
  const ripple = useDesk((s) => s.ripple);
  const clear = () => useDesk.setState({ ripple: null });
  return (
    <AnimatePresence>
      {ripple && (
        <motion.div
          key={ripple.at}
          initial={{ y: -14, opacity: 0, rotate: -1.2 }}
          animate={{ y: 0, opacity: 1, rotate: -0.6 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="perforated relative mx-3 mt-3 bg-slip px-3.5 pb-3 pt-3.5 shadow-[var(--shadow-lift)]"
          role="status"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] font-semibold leading-tight">{ripple.label}</p>
            <div className="flex items-center gap-2">
              <Stamp tone="alert" size="xs" rotate={4}>Re-planned</Stamp>
              <button type="button" onClick={clear} aria-label="Dismiss ripple" className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-ink/10 hover:text-ink">
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          {ripple.items.length ? (
            <ol className="mt-2 space-y-1 text-[13px] leading-snug">
              {ripple.items.map((it, i) => (
                <motion.li
                  key={it}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.09, duration: 0.2 }}
                  className="grid grid-cols-[1rem_1fr] gap-1"
                >
                  <span className="typed text-alert">→</span>
                  <span className="typed text-[12.5px]">{it}</span>
                </motion.li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 typed text-[12.5px] text-ink-2">No change from this day onward.</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Register({ className }: { className?: string }) {
  const season = useDesk((s) => s.season);
  const t = useDesk((s) => s.t);
  const selectPlot = useDesk((s) => s.selectPlot);
  const playing = useDesk((s) => s.playing);
  const day = Math.floor(t);
  const lines = registerFor(season, day);

  return (
    <Sheet className={cn("flex min-h-0 flex-col", className)}>
      <SheetHead
        form="KK-2"
        title="Daily register"
        mr="दैनंदिन नोंदवही"
        right={
          <>
            <SourceStamp live={false} label="Entries from the simulated network" />
            <DatedImpression day={day} playing={playing} />
          </>
        }
      />
      <RippleSlip />
      <div className="ruled min-h-0 flex-1 overflow-y-auto" style={{ ["--rule-gap" as string]: "26px", ["--margin-x" as string]: "62px" }}>
        {lines.length === 0 ? (
          <p className="py-0 pl-[74px] pr-4 text-[13px] leading-[26px] text-ink-3">Nothing recorded on this day. Roll the date stamp, or play the season.</p>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li
                  layout
                  key={`${day}-${l.key}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="grid min-h-[26px] grid-cols-[62px_1fr_auto] items-start"
                >
                  <span className="typed pl-3 text-[11.5px] leading-[26px] text-ink-3">{hhmm(l.hour)}</span>
                  <button
                    type="button"
                    disabled={l.plot === undefined}
                    onClick={() => l.plot !== undefined && selectPlot(l.plot)}
                    className={cn(
                      "min-w-0 pl-3 pr-2 text-left leading-[26px] disabled:cursor-default",
                      l.plot !== undefined && "hover:bg-[color-mix(in_oklab,var(--stamp)_8%,transparent)]",
                      l.alert && "[&_*]:!text-alert",
                    )}
                  >
                    <Ink by={l.by}>{l.text}</Ink>
                  </button>
                  <span className="pr-3 pt-[4px]">
                    {l.by === "verified" ? <Stamp size="xs" rotate={-6} press={false}>Read</Stamp> : null}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
      <div className="border-t border-ink/20 px-4 py-2">
        <InkKey />
      </div>
    </Sheet>
  );
}
