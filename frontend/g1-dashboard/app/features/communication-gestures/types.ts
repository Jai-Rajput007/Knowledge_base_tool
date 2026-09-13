// Types for communication-gestures

/** The set of recorded gestures the robot uses while explaining a reply. */
export interface CommunicationSet {
  enabled: boolean;
  /** Recorded gesture names (tenant-logical, not the on-disk namespaced form) — at most 3. */
  names: string[];
  /** Reply must reach this many characters before comm gestures start (default 120). */
  min_reply_chars: number;
}

/** Duration-based label shown in the picker — mirrors the plan's Short/Medium/Long bands. */
export type DurationBand = "Short" | "Medium" | "Long";

export function durationBand(duration_s: number): DurationBand {
  if (duration_s < 4) return "Short";
  if (duration_s <= 7) return "Medium";
  return "Long";
}
