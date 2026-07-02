"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

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

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [features, setFeatures] = useState<FeaturesMap>({});
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/features");
      if (res.ok) {
        const data = await res.json();
        setFeatures(data);
      }
    } catch {
      // silently fail — features will all default to false
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();

    const evtSource = new EventSource("/api/events");
    evtSource.onmessage = (event) => {
      console.log("Real-time update received, refreshing features...");
      fetchFeatures();
    };

    return () => evtSource.close();
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
