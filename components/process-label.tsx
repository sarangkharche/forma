"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function ProcessLabel({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <motion.span className={reduced ? "" : "process-shimmer"}
    animate={reduced ? undefined : { backgroundPosition: ["200% 0", "-200% 0"] }}
    transition={reduced ? undefined : { duration: 3, repeat: Infinity, ease: "linear" }}>
    {children}
  </motion.span>;
}
