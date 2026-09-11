"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { voiceStudioApi } from "../api";
import { POLL_ACTIVE_MS, POLL_IDLE_MS } from "../constants";
import type { StudioStatus } from "../types";

const ACTIVE_STATES = new Set(["preparing", "playing", "paused"]);

/**
 * Robot playback state + transport actions.
 *
 * The robot owns the truth (another tab or user may also be driving it), so we poll
 * /voice-studio/status — fast while something is playing, slow when idle, and not at
 * all while this browser tab is hidden. Every action also returns the fresh status,
 * so the UI updates immediately without waiting for the next poll.
 */
export function useStudioPlayer() {
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reachable, setReachable] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = status ? ACTIVE_STATES.has(status.state) : false;

  const poll = useCallback(async () => {
    try {
      setStatus(await voiceStudioApi.status());
      setReachable(true);
    } catch (e) {
      setReachable(false);
      console.warn("[VoiceStudio] status poll failed:", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loop = async () => {
      if (!cancelled && document.visibilityState === "visible") await poll();
      if (!cancelled) timer.current = setTimeout(loop, active ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    };
    loop();
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, active]);

  const run = useCallback(async (fn: () => Promise<StudioStatus>, what: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setStatus(next);
      setReachable(true);
      return next;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[VoiceStudio] ${what} failed:`, message);
      setError(message);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const play = useCallback(
    (items: { id: string; text: string }[], language: string) =>
      run(() => voiceStudioApi.play(items, language), "play"),
    [run],
  );
  const pause = useCallback(() => run(voiceStudioApi.pause, "pause"), [run]);
  const resume = useCallback(() => run(voiceStudioApi.resume, "resume"), [run]);
  const stop = useCallback(() => run(voiceStudioApi.stop, "stop"), [run]);

  // Robot-side errors (TTS down, speaker unreachable) arrive through status, not the call.
  const robotError = status?.state === "error" ? status.error : null;

  return {
    status, active, busy, reachable,
    error: error ?? robotError,
    clearError: () => setError(null),
    play, pause, resume, stop,
  };
}
