"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { liveFeedApi } from "../api";

export type LiveFeedPhase = "idle" | "connecting" | "live" | "ended" | "error";

/**
 * FRS "Show live feed" state. The stream is an MJPEG <img>; clearing `src` closes the
 * HTTP connection, which is what makes the FRS process stop encoding preview frames.
 * The feed auto-stops after the server's limit (5 min) — the countdown mirrors it.
 */
export function useLiveFeed() {
  const [phase, setPhase] = useState<LiveFeedPhase>("idle");
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const deadline = useRef<number>(0);

  const stop = useCallback((next: LiveFeedPhase = "idle") => {
    setSrc(null);
    setPhase(next);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      const { url, maxSeconds } = await liveFeedApi.open();
      deadline.current = Date.now() + maxSeconds * 1000;
      setRemaining(maxSeconds);
      setSrc(url);
      console.info("[FRS live feed] opened");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (!src) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        console.info("[FRS live feed] auto-stopped after time limit");
        stop("ended");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [src, stop]);

  const onFrame = useCallback(() => setPhase((p) => (p === "connecting" ? "live" : p)), []);
  const onStreamError = useCallback(() => {
    setError("The camera feed could not be opened. The camera may be off, or the face recognition service is down.");
    stop("error");
  }, [stop]);

  return { phase, src, error, remaining, start, stop, onFrame, onStreamError };
}
