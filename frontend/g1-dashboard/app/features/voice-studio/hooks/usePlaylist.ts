"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_ITEMS, PLAYLIST_STORAGE_KEY } from "../constants";
import type { PlaylistEntry } from "../types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const SAMPLE: PlaylistEntry[] = [
  { id: newId(), title: "Welcome", text: "Hello everyone, and welcome. I'm the reception robot, and I'll be guiding you today." },
  { id: newId(), title: "Safety note", text: "Before we begin, please keep a little distance while I'm walking, and keep the aisles clear." },
];

function load(): PlaylistEntry[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
    if (!raw) return SAMPLE;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : SAMPLE;
  } catch {
    return SAMPLE;
  }
}

/**
 * The turn-by-turn script ("playlist"). Kept as a per-browser draft in localStorage so a
 * refresh doesn't lose a script being prepared; the robot only ever receives it on Play.
 */
export function usePlaylist() {
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Read localStorage after mount (not in a lazy initializer) so the server-rendered
  // HTML matches the first client render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from storage
    setEntries(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* storage unavailable (private mode) — the playlist still works for this visit */
    }
  }, [entries, loaded]);

  const add = useCallback((text = "", afterId?: string) => {
    const entry: PlaylistEntry = { id: newId(), title: "", text };
    setEntries((prev) => {
      if (prev.length >= MAX_ITEMS) return prev;
      if (!afterId) return [...prev, entry];
      const i = prev.findIndex((e) => e.id === afterId);
      return [...prev.slice(0, i + 1), entry, ...prev.slice(i + 1)];
    });
    return entry.id;
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<PlaylistEntry, "id">>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const move = useCallback((id: string, dir: -1 | 1) => {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, setEntries, add, update, remove, move, clear, full: entries.length >= MAX_ITEMS };
}
