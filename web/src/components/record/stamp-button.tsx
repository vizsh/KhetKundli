"use client";

import { forwardRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
// Coarser grain than the small stamps, so the worn rubber still shows at one device pixel per CSS pixel.
const COARSE_INK = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.32' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -5.2 3.05'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ink" | "stamp" };

/**
 * A rubber stamp you press: a square ink block inside a speckled double rule. Pressing drops it 2 px,
 * collapses its shadow and spreads a little ink.
 */
export const StampButton = forwardRef<HTMLButtonElement, Props>(function StampButton({ tone = "ink", className, children, onPointerDown, ...rest }, ref) {
  const reduce = useReducedMotion();
  const [inked, setInked] = useState(0);
  const ink = tone === "stamp" ? "var(--stamp)" : "var(--ink)";
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      onPointerDown={(e) => { setInked((n) => n + 1); onPointerDown?.(e); }}
      className={cn(
        "group relative isolate flex items-center justify-center gap-2.5 rounded-[2px] px-3 text-paper",
        "shadow-[var(--shadow-lift)] transition-[transform,box-shadow] duration-100 ease-out active:translate-y-0.5 active:shadow-[var(--shadow-sheet)]",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
        className,
      )}
      style={{ background: ink, ...rest.style }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-[6px] rounded-[3px] border-[3px]"
        style={{ borderColor: ink, maskImage: COARSE_INK, WebkitMaskImage: COARSE_INK, maskSize: "120px 60px", WebkitMaskSize: "120px 60px" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[3px] rounded-[1px] border-2 border-paper/45"
        style={{ maskImage: COARSE_INK, WebkitMaskImage: COARSE_INK, maskSize: "120px 60px", WebkitMaskSize: "120px 60px" }}
      />
      {!reduce && inked > 0 && (
        <motion.span
          key={inked}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[2px]"
          style={{ background: ink }}
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 1.06, opacity: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
        />
      )}
      <span className="relative flex items-center gap-2.5">{children}</span>
    </button>
  );
});
