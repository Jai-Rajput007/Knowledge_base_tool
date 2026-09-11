"use client";

import { Reorder } from "motion/react";
import { ListMusic, Play, Plus, Eraser } from "lucide-react";
import { MAX_ITEMS } from "../constants";
import { PlaylistItem } from "./PlaylistItem";
import type { ItemState, PlaylistEntry, StudioStatus } from "../types";

interface Props {
  entries: PlaylistEntry[];
  status: StudioStatus | null;
  busy: boolean;
  full: boolean;
  onReorder: (next: PlaylistEntry[]) => void;
  onAdd: () => void;
  onClear: () => void;
  onUpdate: (id: string, patch: Partial<Omit<PlaylistEntry, "id">>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onPlayAll: () => void;
  onPlayOne: (entry: PlaylistEntry) => void;
  onPause: () => void;
  onResume: () => void;
}

/**
 * Turn-taking script: an ordered list of turns. "Play all" speaks every turn in order
 * with a short breath between them; each turn's own play button speaks only that turn.
 */
export function Playlist({
  entries, status, busy, full, onReorder, onAdd, onClear, onUpdate, onRemove, onMove,
  onPlayAll, onPlayOne, onPause, onResume,
}: Props) {
  const stateById = new Map<string, ItemState>((status?.items ?? []).map((i) => [i.id, i.state]));
  const live = status?.state === "playing" || status?.state === "preparing" || status?.state === "paused";
  const currentId = live ? status?.current_item_id : null;
  const playable = entries.filter((e) => e.text.trim()).length;

  return (
    <section className="rounded-2xl border border-border bg-card/40 flex flex-col min-h-0">
      <header className="flex items-center gap-3 px-5 pt-5 pb-3 flex-wrap">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">
          <ListMusic className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-foreground">Script playlist</h2>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {entries.length} {entries.length === 1 ? "turn" : "turns"} · drag or use the arrows to reorder
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            title="Remove all turns"
            aria-label="Remove all turns"
            className="h-9 w-9 grid place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onPlayAll}
            disabled={playable === 0 || busy}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-3.5 w-3.5" fill="currentColor" /> Play all
          </button>
        </div>
      </header>

      <div className="px-3 pb-3 max-h-[62vh] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="mx-2 my-4 rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-foreground">No turns yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add a turn for each thing the robot should say, in order.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={entries} onReorder={onReorder} layoutScroll className="space-y-2 p-2">
            {entries.map((entry, i) => (
              <PlaylistItem
                key={entry.id}
                entry={entry}
                index={i}
                count={entries.length}
                itemState={stateById.get(entry.id) ?? null}
                isCurrent={currentId === entry.id}
                robotPaused={status?.state === "paused"}
                busy={busy}
                onChange={(patch) => onUpdate(entry.id, patch)}
                onPlay={() => onPlayOne(entry)}
                onPause={onPause}
                onResume={onResume}
                onMove={(dir) => onMove(entry.id, dir)}
                onRemove={() => onRemove(entry.id)}
              />
            ))}
          </Reorder.Group>
        )}
      </div>

      <footer className="px-5 pb-5">
        <button
          type="button"
          onClick={onAdd}
          disabled={full}
          className="w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" /> {full ? `Playlist is full (${MAX_ITEMS} turns)` : "Add turn"}
        </button>
      </footer>
    </section>
  );
}
