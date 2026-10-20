"use client";

import { MotionConfig } from "motion/react";

/** Honour the operating system's reduced-motion setting in every Motion animation (slides, layout, scale). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
