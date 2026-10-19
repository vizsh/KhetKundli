"use client";

import { motion, useReducedMotion } from "motion/react";
import { dateOf, MONTHS } from "@/lib/sim/calendar";
import { cn } from "@/lib/utils";

// Worn rubber: a turbulence mask knocks speckles out of the ink.
export const INK_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.6 2.15'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

type Tone = "stamp" | "alert" | "ink" | "ballpoint";

const TONE: Record<Tone, string> = {
  stamp: "text-stamp border-stamp",
  alert: "text-alert border-alert",
  ink: "text-ink border-ink",
  ballpoint: "text-ballpoint border-ballpoint",
};

export function Stamp({
  children,
  tone = "stamp",
  size = "sm",
  rotate = -3,
  press = true,
  round = false,
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  size?: "xs" | "sm" | "md" | "lg";
  rotate?: number;
  press?: boolean;
  round?: boolean;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const sizes = {
    xs: "text-[9px] px-1 py-px border-[1.5px] tracking-[0.08em]",
    sm: "text-[10.5px] px-1.5 py-0.5 border-2 tracking-[0.08em]",
    md: "text-[13px] px-2 py-1 border-[2.5px] tracking-[0.1em]",
    lg: "text-[18px] px-3 py-1.5 border-[3px] tracking-[0.12em]",
  }[size];
  return (
    <motion.span
      title={title}
      initial={press && !reduce ? { scale: 1.3, opacity: 0.45, rotate: rotate - 4 } : false}
      animate={{ scale: 1, opacity: 0.92, rotate }}
      transition={{ type: "spring", stiffness: 700, damping: 26, mass: 0.6 }}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap font-bold uppercase leading-none select-none",
        "[font-stretch:88%]",
        round ? "rounded-full aspect-square" : "rounded-[3px]",
        "outline outline-1 outline-offset-[2px] outline-current/40",
        TONE[tone],
        sizes,
        className,
      )}
      style={{ maskImage: INK_MASK, WebkitMaskImage: INK_MASK, maskSize: "160px 80px", WebkitMaskSize: "160px 80px" }}
    >
      {children}
    </motion.span>
  );
}

/** The violet impression the date stamp leaves on a sheet; re-presses when the day changes. */
export function DatedImpression({ day, playing, size = "xs" }: { day: number; playing: boolean; size?: "xs" | "sm" }) {
  const { d, m, y } = dateOf(day);
  return (
    <Stamp key={day} tone="stamp" size={size} rotate={-5} press={!playing} title="Stamped with the desk's date">
      {String(d).padStart(2, "0")} {MONTHS[m]} {y}
    </Stamp>
  );
}

export function SourceStamp({ live, label, size = "xs" }: { live: boolean; label?: string; size?: "xs" | "sm" }) {
  return (
    <Stamp tone={live ? "stamp" : "ink"} size={size} rotate={live ? -4 : 2} title={label}>
      {live ? "Live" : "Simulated"}
    </Stamp>
  );
}
