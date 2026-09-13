// Hooks for communication-gestures

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCommunicationSet, putCommunicationSet, testCommunicationSet, verifyUnitreeRoles } from "./api";
import {
  durationBand,
  EMPTY_UNITREE_ROLES,
  UNITREE_ROLES,
  type CommunicationMode,
  type CommunicationSet,
  type DurationBand,
  type UnitreeRole,
  type UnitreeRoles,
  type UnitreeVerifyResult,
} from "./types";

const EMPTY: CommunicationSet = {
  enabled: false,
  mode: "recorded",
  names: [],
  unitree_roles: EMPTY_UNITREE_ROLES,
  min_reply_chars: 120,
};

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function sameNames(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function sameRoles(a: UnitreeRoles, b: UnitreeRoles): boolean {
  return UNITREE_ROLES.every((r) => (a[r] || "").trim() === (b[r] || "").trim());
}

/** The minimal shape this hook needs from a recorded gesture, to compute its band. */
export interface RecordedLite {
  name: string;
  duration_s: number;
}

/**
 * Loads and saves the robot's "use while explaining" gesture set. Selection is a
 * local draft until Save is pressed — nothing touches the robot until the user commits it.
 *
 * Two mutually exclusive modes (see types.ts):
 *   mode="recorded"    — at most one gesture per Short/Medium/Long band from the Recorded
 *                        tab (`durationBand()`); needs a physical waist lock on the robot.
 *   mode="unitree_app" — short/medium/long role → gesture name taught through the Unitree
 *                        app; no waist lock needed, but must pass verifyRoles() (which
 *                        actually fires each named gesture briefly to confirm it exists)
 *                        before it can be enabled, since these aren't local files we can
 *                        just check for.
 */
export function useCommunicationSet(recorded: RecordedLite[]) {
  const [saved, setSaved] = useState<CommunicationSet>(EMPTY);
  const [mode, setMode] = useState<CommunicationMode>("recorded");
  const [selected, setSelected] = useState<string[]>([]);
  const [unitreeRoles, setUnitreeRolesState] = useState<UnitreeRoles>(EMPTY_UNITREE_ROLES);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<UnitreeVerifyResult | null>(null);
  const [verifiedRoles, setVerifiedRoles] = useState<UnitreeRoles | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCommunicationSet();
      setSaved(data);
      setMode(data.mode);
      setSelected(data.names);
      setUnitreeRolesState(data.unitree_roles);
      setEnabled(data.enabled);
      setVerifyResult(null);
      setVerifiedRoles(null);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load the communication-gesture set"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // refresh() is the initial load — it's an external-system fetch kicked off from
    // an effect (the standard pattern), not a synchronous derived-state update.
    void refresh();
  }, [refresh]);

  const bandOf = useCallback(
    (name: string): DurationBand | null => {
      const g = recorded.find((r) => r.name === name);
      return g ? durationBand(g.duration_s) : null;
    },
    [recorded]
  );

  const addToSet = useCallback(
    (name: string) => {
      const band = bandOf(name);
      if (!band) return; // unknown gesture (stale list) — ignore rather than corrupt the set
      setSelected((prev) => {
        if (prev.includes(name)) return prev;
        const withoutSameBand = prev.filter((n) => bandOf(n) !== band);
        return [...withoutSameBand, name];
      });
    },
    [bandOf]
  );

  const removeFromSet = useCallback((name: string) => {
    setSelected((prev) => prev.filter((n) => n !== name));
  }, []);

  const setUnitreeRole = useCallback((role: UnitreeRole, name: string) => {
    setUnitreeRolesState((prev) => ({ ...prev, [role]: name }));
    setVerifyResult(null);
    setVerifiedRoles(null);
  }, []);

  const switchMode = useCallback((next: CommunicationMode) => {
    setMode(next);
    setVerifyResult(null);
    setVerifiedRoles(null);
  }, []);

  const dirty =
    mode !== saved.mode ||
    enabled !== saved.enabled ||
    (mode === "recorded" ? !sameNames(selected, saved.names) : !sameRoles(unitreeRoles, saved.unitree_roles));

  // mode="unitree_app" can only be enabled once the exact role→name mapping currently
  // set has actually been confirmed present on the robot via verifyRoles() — there's no
  // way to check a Unitree-app-taught gesture exists other than firing it.
  const rolesVerified = useMemo(
    () => mode === "unitree_app" && verifiedRoles !== null && sameRoles(unitreeRoles, verifiedRoles),
    [mode, unitreeRoles, verifiedRoles]
  );
  const canEnable = mode === "recorded" ? selected.length > 0 : rolesVerified;

  const verifyRoles = useCallback(async () => {
    const toCheck: UnitreeRoles = { ...EMPTY_UNITREE_ROLES };
    let any = false;
    for (const r of UNITREE_ROLES) {
      const v = (unitreeRoles[r] || "").trim();
      if (v) {
        toCheck[r] = v;
        any = true;
      }
    }
    if (!any) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyUnitreeRoles(toCheck);
      setVerifyResult(result);
      const allFound = UNITREE_ROLES.every((r) => !toCheck[r] || result[r]?.found);
      setVerifiedRoles(allFound ? { ...unitreeRoles } : null);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to verify Unitree-app gestures"));
      setVerifiedRoles(null);
    } finally {
      setVerifying(false);
    }
  }, [unitreeRoles]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await putCommunicationSet({
        enabled: enabled && canEnable,
        mode,
        names: selected,
        unitree_roles: unitreeRoles,
      });
      setSaved(result);
      setMode(result.mode);
      setSelected(result.names);
      setUnitreeRolesState(result.unitree_roles);
      setEnabled(result.enabled);
      return true;
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save the communication-gesture set"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled, canEnable, mode, selected, unitreeRoles]);

  const test = useCallback(async () => {
    if (mode === "recorded" && selected.length === 0) return;
    if (mode === "unitree_app" && !UNITREE_ROLES.some((r) => unitreeRoles[r]?.trim())) return;
    setTesting(true);
    setError(null);
    try {
      await testCommunicationSet(mode, mode === "recorded" ? selected : unitreeRoles, 10);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to start the test sequence"));
    } finally {
      setTimeout(() => setTesting(false), 10_000);
    }
  }, [mode, selected, unitreeRoles]);

  return {
    saved,
    mode,
    switchMode,
    selected,
    unitreeRoles,
    setUnitreeRole,
    enabled,
    setEnabled,
    canEnable,
    bandOf,
    addToSet,
    removeFromSet,
    dirty,
    loading,
    saving,
    testing,
    verifying,
    verifyResult,
    rolesVerified,
    verifyRoles,
    error,
    clearError: () => setError(null),
    save,
    test,
    refresh,
  };
}
