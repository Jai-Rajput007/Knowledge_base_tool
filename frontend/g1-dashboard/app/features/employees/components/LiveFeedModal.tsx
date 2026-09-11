"use client";

import { useEffect } from "react";
import { CircleAlert, LoaderCircle, RotateCcw, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveFeed } from "../hooks/useLiveFeed";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * FRS debug view: the robot camera exactly as face recognition sees it — boxes, names,
 * confidence and embedding distance. [P] marks the primary person the robot talks to.
 * Admin-only; opening it is audit-logged by the backend; auto-stops after 5 minutes.
 */
export function LiveFeedModal({ onClose }: { onClose: () => void }) {
  const feed = useLiveFeed();
  const { start, stop } = feed;

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const live = feed.phase === "live";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="FRS live camera feed"
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Video className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-foreground">Live feed</h2>
            <p className="text-xs text-muted-foreground">What face recognition sees right now</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> Live
              </span>
            )}
            {feed.src && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground" title="Stops automatically">
                {fmt(feed.remaining)}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close live feed"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative aspect-video bg-foreground/5">
          {feed.src && (
            // eslint-disable-next-line @next/next/no-img-element -- MJPEG stream, not an optimisable image
            <img
              src={feed.src}
              alt="FRS camera feed with face boxes"
              onLoad={feed.onFrame}
              onError={feed.onStreamError}
              className={cn("absolute inset-0 h-full w-full object-contain", !live && "opacity-0")}
            />
          )}

          {feed.phase === "connecting" && (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <span className="flex items-center gap-2 text-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Connecting to the robot camera…
              </span>
            </div>
          )}

          {(feed.phase === "error" || feed.phase === "ended") && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="space-y-3 max-w-sm">
                {feed.phase === "error" ? (
                  <p className="flex items-start gap-2 text-sm text-destructive text-left">
                    <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" /> {feed.error}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">The feed stopped after 5 minutes to keep the robot light.</p>
                )}
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" /> {feed.phase === "error" ? "Try again" : "Watch again"}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span><span className="text-primary">[P]</span> primary person</span>
          <span>% confidence</span>
          <span>d = distance / threshold (lower is a closer match)</span>
          <span className="ml-auto normal-case tracking-normal">Closing this stops the stream.</span>
        </footer>
      </div>
    </div>
  );
}
