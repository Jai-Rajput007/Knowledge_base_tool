// Hooks for communication-gestures

import { useState, useEffect, useCallback } from "react";
import { getCommunicationSet, putCommunicationSet, testCommunicationSet } from "./api";
import type { CommunicationSet } from "./types";

const EMPTY: CommunicationSet = { enabled: false, names: [], min_reply_chars: 120 };

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * Loads and saves the robot's "use while explaining" gesture set. Selection is a
 * local draft (`selected`) until Save is pressed — toggling a gesture on the page
 * doesn't touch the robot until the user commits it, so a half-made change never
 * takes effect by accident.
 */
export function useCommunicationSet() {
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

  const MAX_SELECTED = 3;

  const toggle = useCallback((name: string) => {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, name];
    });
  }, []);

  const dirty =
    enabled !== saved.enabled ||
    selected.length !== saved.names.length ||
    selected.some((n, i) => n !== saved.names[i]);

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
    toggle,
    dirty,
    loading,
    saving,
    testing,
    error,
    clearError: () => setError(null),
    save,
    test,
    refresh,
    maxSelected: MAX_SELECTED,
  };
}
