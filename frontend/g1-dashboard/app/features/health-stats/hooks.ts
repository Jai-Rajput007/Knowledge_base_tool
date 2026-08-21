import { useCallback, useEffect, useState } from "react";
import { fetchTelemetry } from "./api";
import type { TelemetryResponse } from "./types";

export function useTelemetry(intervalMs = 5000) {
  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchTelemetry();
      setTelemetry(data);
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { telemetry, isOffline, refresh };
}
