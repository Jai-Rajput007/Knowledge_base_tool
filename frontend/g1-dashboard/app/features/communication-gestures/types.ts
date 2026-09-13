// Types for communication-gestures

/**
 * Which mechanism drives "use while explaining":
 *   "recorded"     — our own Veda-recorded .gesture files, played via robot_agent's
 *                    rt/arm_sdk takeover. Needs a physical waist lock fitted to the robot —
 *                    without one, recording was found to destabilize the robot's balance.
 *   "unitree_app"  — 3 gestures taught through the Unitree mobile app's "demo teaching"
 *                    feature, fired via ExecuteAction(name). No waist lock needed — Unitree's
 *                    own arm-action service handles the waist internally.
 */
export type CommunicationMode = "recorded" | "unitree_app";

export type UnitreeRole = "short" | "medium" | "long";
export const UNITREE_ROLES: UnitreeRole[] = ["short", "medium", "long"];

/** short/medium/long → gesture name taught through the Unitree app. Empty string = unset. */
export type UnitreeRoles = Record<UnitreeRole, string>;

export const EMPTY_UNITREE_ROLES: UnitreeRoles = { short: "", medium: "", long: "" };

/** The set of gestures the robot uses while explaining a reply. */
export interface CommunicationSet {
  enabled: boolean;
  mode: CommunicationMode;
  /** Recorded gesture names (tenant-logical, not the on-disk namespaced form) — at most 3. mode="recorded". */
  names: string[];
  /** mode="unitree_app": role → gesture name taught through the Unitree app. */
  unitree_roles: UnitreeRoles;
  /** Reply must reach this many characters before comm gestures start (default 120). */
  min_reply_chars: number;
}

/** Result of verifying one role's Unitree-app gesture actually exists on the robot. */
export interface UnitreeRoleVerification {
  name: string;
  found: boolean;
  ret: number;
}

export type UnitreeVerifyResult = Partial<Record<UnitreeRole, UnitreeRoleVerification>>;

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
