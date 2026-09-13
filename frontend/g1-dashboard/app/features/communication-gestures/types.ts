// Types for communication-gestures

/** The set of recorded gestures the robot uses while explaining a reply. */
export interface CommunicationSet {
  enabled: boolean;
  /** Recorded gesture names (tenant-logical, not the on-disk namespaced form) — at most 3. */
  names: string[];
  /** Reply must reach this many characters before comm gestures start (default 120). */
  min_reply_chars: number;
}

/**
 * Duration-based band a recorded gesture falls into. Exactly one gesture per band may
 * be used in the communication set at a time — the robot picks whichever band's
 * gesture fits how much speech is left, so two gestures competing for the same band
 * would leave the other one never chosen. Mirrors the backend's `_duration_band()`
 * (knowledge_base_tool/backend/app/api/v1/endpoints/gestures.py) and robot_sync's
 * copy of the same thresholds — keep all three in sync if these ever change.
 */
export type DurationBand = "Short" | "Medium" | "Long";

export function durationBand(duration_s: number): DurationBand {
  if (duration_s < 10) return "Short";   // 1-10s
  if (duration_s < 30) return "Medium";  // 10-30s
  return "Long";                         // 30s+
}

export const DURATION_BANDS: DurationBand[] = ["Short", "Medium", "Long"];
