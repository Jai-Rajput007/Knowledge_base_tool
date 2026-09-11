"use client";

import { Reorder, useDragControls } from "motion/react";
import { Check, ChevronDown, ChevronUp, GripVertical, Pause, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Equalizer } from "./Equalizer";
import type { ItemState, PlaylistEntry } from "../types";

interface Props {
  entry: PlaylistEntry;
  index: number;
  count: number;
  /** State of this entry in the robot's current session, if it is part of it. */
  itemState: ItemState | null;
  isCurrent: boolean;
  robotPaused: boolean;
  busy: boolean;
  onChange: (patch: Partial<Omit<PlaylistEntry, "id">>) => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One turn of the script. Drag by the grip (the text fields stay selectable), or use the
 * arrows. Its play button speaks just this turn; while it is the one speaking, the same
 * button pauses/resumes it.
 */
export function PlaylistItem({
  entry, index, count, itemState, isCurrent, robotPaused, busy,
  onChange, onPlay, onPause, onResume, onMove, onRemove,
}: Props) {
  const controls = useDragControls();
  const speaking = isCurrent && !robotPaused;
  const empty = !entry.text.trim();

  const primaryAction = isCurrent ? (robotPaused ? onResume : onPause) : onPlay;
  const primaryLabel = isCurrent ? (robotPaused ? "Resume this turn" : "Pause") : "Play this turn";

  return (
    <Reorder.Item
      value={entry}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      whileDrag={{ scale: 1.015, boxShadow: "0 12px 30px -12px rgba(0,0,0,0.25)", zIndex: 20 }}
      style={{ position: "relative", borderRadius: 16 }}
    >
      <div
        className={cn(
          "group flex gap-3 rounded-2xl border bg-background p-3 pr-2",
          isCurrent ? "border-primary/50 ring-2 ring-primary/15" : "border-border",
        )}
      >
        <div className="flex flex-col items-center gap-1 pt-1">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            aria-label="Drag to reorder"
            className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span
            className={cn(
              "grid place-items-center h-6 w-6 rounded-full font-mono text-[10px] tabular-nums",
              isCurrent ? "bg-primary text-primary-foreground" : itemState === "done" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {itemState === "done" && !isCurrent ? <Check className="h-3 w-3" /> : index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              value={entry.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={`Turn ${index + 1}`}
              aria-label={`Title for turn ${index + 1}`}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {isCurrent && (
              <span className="flex items-center gap-1.5 text-primary font-mono text-[10px] uppercase tracking-widest shrink-0">
                <Equalizer active={speaking} className="h-3" />
                {robotPaused ? "Paused" : "Speaking"}
              </span>
            )}
            {itemState === "error" && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-destructive shrink-0">Failed</span>
            )}
          </div>
          <textarea
            value={entry.text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={3}
            placeholder="Paste or type what the robot should say for this turn…"
            aria-label={`Text for turn ${index + 1}`}
            className="w-full resize-y min-h-[72px] rounded-lg border border-border/70 bg-card/40 px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50"
          />
          <p className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {entry.text.length.toLocaleString()} chars
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={primaryAction}
            disabled={(empty && !isCurrent) || busy}
            aria-label={primaryLabel}
            title={primaryLabel}
            className={cn(
              "h-9 w-9 grid place-items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              isCurrent
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {speaking ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label="Move down"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove turn"
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Reorder.Item>
  );
}
