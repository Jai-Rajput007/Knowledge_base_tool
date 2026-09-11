"use client";

import { Pause, Play, Square, LoaderCircle, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Equalizer } from "./Equalizer";
import type { NowPlaying, StudioStatus } from "../types";

const STATE_PILL: Record<string, { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-muted text-muted-foreground border-border" },
  preparing: { label: "Preparing", className: "bg-primary/10 text-primary border-primary/20" },
  playing: { label: "Speaking", className: "bg-primary/15 text-primary border-primary/30" },
  paused: { label: "Paused", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  error: { label: "Error", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface Props {
  status: StudioStatus | null;
  nowPlaying: NowPlaying | null;
  busy: boolean;
  reachable: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/** "Now playing" strip: what the robot is saying right now, progress, pause/resume/stop. */
export function TransportBar({ status, nowPlaying, busy, reachable, onPause, onResume, onStop }: Props) {
  const state = status?.state ?? "idle";
  const pill = STATE_PILL[state] ?? STATE_PILL.idle;
  const isPlaying = state === "playing" || state === "preparing";
  const isPaused = state === "paused";
  const live = isPlaying || isPaused;

  const items = status?.items ?? [];
  const done = items.filter((i) => i.state === "done").length;
  const segPct =
    status && status.segment_count > 0 ? Math.round((status.segment_index / status.segment_count) * 100) : 0;

  return (
    <section
      aria-label="Robot playback"
      className="rounded-2xl border border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 p-4 sm:p-5 shadow-sm"
    >
      <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
        <div
          className={cn(
            "grid place-items-center h-12 w-12 shrink-0 rounded-xl",
            live ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {state === "preparing" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <Equalizer active={state === "playing"} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
                pill.className,
              )}
            >
              {pill.label}
            </span>
            {!reachable && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-destructive">
                <WifiOff className="h-3 w-3" /> Robot offline
              </span>
            )}
            {live && items.length > 1 && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Turn {Math.min(done + 1, items.length)} of {items.length}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {live && nowPlaying ? nowPlaying.label : "Nothing playing"}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {live && nowPlaying
              ? nowPlaying.snippet
              : "Type a line, upload a .txt script, or play a turn from the playlist."}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={isPaused ? onResume : onPause}
            disabled={!live || busy}
            aria-label={isPaused ? "Resume" : "Pause"}
            className="h-11 w-11 grid place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {isPaused ? <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!live || busy}
            aria-label="Stop"
            className="h-11 w-11 grid place-items-center rounded-full border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="mt-4 h-1 rounded-full bg-muted overflow-hidden" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", isPaused ? "bg-amber-500" : "bg-primary")}
          style={{ width: `${live ? segPct : 0}%` }}
        />
      </div>
      {live && status && status.segment_count > 0 && (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
          Sentence {status.segment_index} / {status.segment_count}
        </p>
      )}
    </section>
  );
}
