/**
 * Session-scoped demo state. Lives in sessionStorage so a visitor's changes
 * (new personas, FRS entries, tickets…) survive page reloads for the rest of
 * their browser session, and every new session starts from a clean seed.
 */

import { createSeedState, type DemoState } from "./seed";

const KEY = "veda-demo-state-v1";
let cache: DemoState | null = null;

export function getState(): DemoState {
  if (cache) return cache;
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed?.version === 1) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* storage unavailable or corrupt — fall back to a fresh seed */
  }
  cache = createSeedState();
  persist();
  return cache;
}

export function persist() {
  if (!cache || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded or private mode — the demo keeps working in memory */
  }
}

/** Apply a change and persist it. */
export function mutate<T>(fn: (s: DemoState) => T): T {
  const s = getState();
  const result = fn(s);
  persist();
  return result;
}

export function resetDemoState() {
  cache = createSeedState();
  persist();
}
