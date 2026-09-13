// Hooks for vlm-vision

import { useState, useEffect, useCallback } from "react";
import { getVisionConfig, putVisionEnabled } from "./api";
import type { VisionConfig } from "./types";

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function useVisionConfig() {
  const [config, setConfig] = useState<VisionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConfig(await getVisionConfig());
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load the vision tool's config from the robot"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    setToggling(true);
    setError(null);
    try {
      const result = await putVisionEnabled(enabled);
      setConfig(result);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to update the vision tool"));
    } finally {
      setToggling(false);
    }
  }, []);

  return { config, loading, toggling, error, clearError: () => setError(null), setEnabled, refresh };
}
