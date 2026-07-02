import React from "react";
import { WakeWordJob, LocalStatus } from "../types";
import { StatusDot, statusColor } from "../helpers";

interface LiveProgressProps {
  activeJob: WakeWordJob | null;
  localStatus: LocalStatus | null;
  logs: string[];
  logRef: React.RefObject<HTMLDivElement | null>;
  fetchLocalStatus: (id: number) => void;
  cancelJob: (id: number, isLocal: boolean) => void;
}

export function LiveProgress({
  activeJob, localStatus, logs, logRef, fetchLocalStatus, cancelJob
}: LiveProgressProps) {
  if (!activeJob) return null;

  return (
    <section id="progress" className="border-t border-border pt-8 scroll-mt-28">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <span className="text-primary font-mono text-sm">[03]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">live progress</h2>
        </div>
        <div className="flex items-center gap-3">
          {activeJob.backend === "local_agx" && (
            <button
              onClick={() => fetchLocalStatus(activeJob.id)}
              className="px-3 py-1 border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-primary hover:text-primary transition-colors"
            >
              REFRESH
            </button>
          )}
          <button
            onClick={() => cancelJob(activeJob.id, activeJob.backend === "local_agx")}
            className="px-3 py-1 border border-red-400/40 text-red-400 font-mono text-[10px] uppercase hover:bg-red-400/10 transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>

      <div className="border border-border bg-card/50 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusDot s={activeJob.status} />
            <span className={`font-mono text-sm font-bold uppercase ${statusColor(activeJob.status)}`}>
              {activeJob.status}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              — "{activeJob.wake_phrase}" ({activeJob.quality})
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            job #{activeJob.id} · {activeJob.backend}
          </span>
        </div>

        {localStatus && activeJob.backend === "local_agx" && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                step {localStatus.agx_live.step}/{localStatus.agx_live.total_steps} — {localStatus.agx_live.message}
              </span>
              <span className="font-mono text-[10px] text-primary">{localStatus.progress_pct}%</span>
            </div>
            <div className="h-1 bg-border">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${localStatus.progress_pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-6 gap-1">
          {["Install", "Config", "Download", "Augment", "Train", "Export"].map((step, i) => {
            const current = localStatus?.agx_live.step ?? 0;
            const done = current > i + 1;
            const active = current === i + 1;
            return (
              <div key={step} className={`border p-2 text-center transition-colors
                ${done ? "border-green-400/50 bg-green-400/5" : active ? "border-primary/50 bg-primary/5 animate-pulse" : "border-border/30"}`}
              >
                <p className={`font-mono text-[10px] uppercase ${done ? "text-green-400" : active ? "text-primary" : "text-muted-foreground/30"}`}>
                  {done ? "✓" : active ? "●" : "○"} {step}
                </p>
              </div>
            );
          })}
        </div>

        {logs.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// output log</p>
            <div
              ref={logRef}
              className="bg-black/40 border border-border/50 p-4 h-48 overflow-y-auto font-mono text-[10px] text-green-400/80 space-y-0.5"
            >
              {logs.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
