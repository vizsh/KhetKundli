"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Counter from "@/components/Counter";
import { dateOf, MONTHS } from "@/lib/sim/calendar";
import { useDesk } from "@/lib/store";
import { cn } from "@/lib/utils";

/** The date stamp at poster scale: three rubber bands that roll with the season clock. Display only. */
export function PosterStamp({ size = 84, className }: { size?: number; className?: string }) {
  const t = useDesk((s) => s.t);
  const reduce = useReducedMotion();
  const { d, m, y } = dateOf(Math.floor(t));
  const band = "grid place-items-center overflow-hidden rounded-[3px] bg-ink text-paper";
  return (
    <div className={cn("inline-flex items-stretch gap-2 rounded-[4px] border-2 border-board-ink p-2", className)} role="img" aria-label={`${d} ${MONTHS[m]} ${y}`}>
      <div className={band} style={{ width: size * 1.25, height: size * 1.2 }}>
        <Counter value={d} minDigits={2} fontSize={size} fontWeight={700} intro={false} duration={0.4} bounce={0.12} motionBlur={false} className="typed" />
      </div>
      <div className={cn(band, "relative")} style={{ width: size * 1.95, height: size * 1.2 }}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={m}
            initial={reduce ? false : { y: "70%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={reduce ? undefined : { y: "-70%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 36 }}
            className="font-bold tracking-[0.06em] [font-stretch:80%]"
            style={{ fontSize: size * 0.92 }}
          >
            {MONTHS[m]}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={band} style={{ width: size * 2.45, height: size * 1.2 }}>
        <Counter value={y} fontSize={size} fontWeight={700} intro={false} duration={0.45} motionBlur={false} className="typed" format={{ useGrouping: false }} />
      </div>
    </div>
  );
}
