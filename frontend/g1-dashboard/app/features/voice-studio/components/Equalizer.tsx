"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const BARS = [0.55, 1, 0.7, 0.85];

/** Small level-meter glyph: moves while the robot is speaking, rests otherwise. */
export function Equalizer({ active, className }: { active: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("flex items-end gap-[3px] h-4", className)} aria-hidden>
      {BARS.map((peak, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-current origin-bottom"
          style={{ height: "100%" }}
          initial={false}
          animate={
            active && !reduce
              ? { scaleY: [0.25, peak, 0.4, peak * 0.8, 0.25] }
              : { scaleY: 0.25 }
          }
          transition={
            active && !reduce
              ? { duration: 0.9 + i * 0.13, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}
