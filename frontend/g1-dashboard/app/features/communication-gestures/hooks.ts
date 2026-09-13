// Hooks for communication-gestures

import { useCallback, useEffect, useState } from "react";
import { getCommunicationSet, putCommunicationSet, testCommunicationSet } from "./api";
import { durationBand, type CommunicationSet, type DurationBand } from "./types";

const EMPTY: CommunicationSet = { enabled: false, names: [], min_reply_chars: 120 };

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function sameNames(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/** The minimal shape this hook needs from a recorded gesture, to compute its band. */
export interface RecordedLite {
  name: string;
  duration_s: number;
}

/**
 * Loads and saves the robot's "use while explaining" gesture set. Selection is a
 * local draft (`selected`) until Save is pressed — adding/removing a gesture from the
 * Recorded tab or the panel below doesn't touch the robot until the user commits it.
 *
 * The set holds at most one gesture per Short/Medium/Long band (`durationBand()`) —
 * the robot picks whichever band's gesture fits the remaining speech, so two
 * gestures in the same band would mean one of them is never chosen. `addToSet`
 * enforces this by silently replacing whatever currently occupies that gesture's
 * band; `removeFromSet` only drops it from this set, never deletes the recording.
 */
export function useCommunicationSet(recorded: RecordedLite[]) {
  const [saved, setSaved] = useState<CommunicationSet>(EMPTY);
  const [selected, setSelected] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCommunicationSet();
      setSaved(data);
      setSelected(data.names);
      setEnabled(data.enabled);
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

  const dirty = enabled !== saved.enabled || !sameNames(selected, saved.names);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await putCommunicationSet({ enabled, names: selected });
      setSaved(result);
      setSelected(result.names);
      setEnabled(result.enabled);
      return true;
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save the communication-gesture set"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled, selected]);

  const test = useCallback(async () => {
    if (selected.length === 0) return;
    setTesting(true);
    setError(null);
    try {
      await testCommunicationSet(selected, 10);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to start the test sequence"));
    } finally {
      setTimeout(() => setTesting(false), 10_000);
    }
  }, [selected]);

  return {
    saved,
    selected,
    enabled,
    setEnabled,
    bandOf,
    addToSet,
    removeFromSet,
    dirty,
    loading,
    saving,
    testing,
    error,
    clearError: () => setError(null),
    save,
    test,
    refresh,
  };
}
