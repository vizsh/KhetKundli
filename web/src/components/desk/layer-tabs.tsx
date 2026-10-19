"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { useDesk, type Layer } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS: { id: Layer; label: string; short: string; mr: string }[] = [
  { id: "pest", label: "Pest Radar", short: "Pest", mr: "कीड रडार" },
  { id: "wave", label: "Harvest Wave", short: "Harvest", mr: "तोडणी लाट" },
  { id: "water", label: "Water Commons", short: "Water", mr: "पाणी" },
  { id: "runs", label: "Pooled Runs", short: "Runs", mr: "वाहतूक" },
];

export function LayerTabs() {
  const layer = useDesk((s) => s.layer);
  const setLayer = useDesk((s) => s.setLayer);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label="Map layer" className="relative z-10 -mb-px flex gap-1 sm:pl-3">
      {TABS.map((tab, i) => {
        const active = tab.id === layer;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            aria-selected={active}
            aria-label={tab.label}
            tabIndex={active ? 0 : -1}
            onClick={() => setLayer(tab.id)}
            onKeyDown={(e) => {
              const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!dir) return;
              const next = (i + dir + TABS.length) % TABS.length;
              setLayer(TABS[next].id);
              refs.current[next]?.focus();
            }}
            className={cn(
              "relative flex min-w-0 flex-1 items-baseline justify-center gap-2 rounded-t-[5px] px-2 pb-2 pt-2 text-left transition-colors sm:flex-none sm:justify-start sm:px-4",
              active ? "text-ink" : "bg-board-deep text-board-ink hover:bg-[#c29d5c]",
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-paper"
                className="absolute inset-0 -bottom-1 rounded-t-[5px] bg-paper shadow-[0_-1px_0_rgb(80_60_20/0.12)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative text-[14px] font-semibold [font-stretch:90%]">
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </span>
            <span className={cn("relative hidden text-[12px] sm:inline", active ? "text-ink-2" : "text-board-ink-2")} style={{ fontFamily: "var(--font-anek-deva)" }}>{tab.mr}</span>
          </button>
        );
      })}
    </div>
  );
}
