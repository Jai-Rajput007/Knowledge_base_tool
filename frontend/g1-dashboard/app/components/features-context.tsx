"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export type FeaturesMap = Record<string, boolean>;

interface FeaturesContextValue {
  features: FeaturesMap;
  loading: boolean;
  isEnabled: (key: string) => boolean;
  refresh: () => void;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: {},
  loading: true,
  isEnabled: () => false,
  refresh: () => {},
});

/**
 * Polls /api/events every POLL_INTERVAL_MS for a monotonic sequence counter.
 * When the counter changes, it means the MQTT listener received an update and
 * we need to refresh features. This approach creates zero long-lived Promises
 * on the server, permanently avoiding the Turbopack AsyncHook memory leak.
 */
const POLL_INTERVAL_MS = 5000; // 5 seconds — lightweight since GET returns instantly

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<FeaturesMap>({});
  const [loading, setLoading] = useState(true);
  const lastSeqRef = useRef<number>(-1);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await api.getTenantFeatures();
      if (res.data) {
        setFeatures(res.data as FeaturesMap);
      }
    } catch {
      // silently fail — features will all default to false
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) return;
        const data = await res.json();
        const newSeq = data.seq as number;

        if (lastSeqRef.current === -1) {
          // First poll — just record the baseline, don't trigger a refresh
          lastSeqRef.current = newSeq;
          return;
        }

        if (newSeq !== lastSeqRef.current) {
          lastSeqRef.current = newSeq;
          console.log("Real-time update received (seq=%d), refreshing features...", newSeq);
          fetchFeatures();
        }
      } catch {
        // network blip — will retry on next interval
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchFeatures]);

  const isEnabled = useCallback(
    (key: string) => features[key] === true,
    [features]
  );

  return (
    <FeaturesContext.Provider value={{ features, loading, isEnabled, refresh: fetchFeatures }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  return useContext(FeaturesContext);
}
