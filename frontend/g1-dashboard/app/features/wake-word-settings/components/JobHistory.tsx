import React from "react";
import { WakeWordJob } from "../types";
import { StatusDot, statusColor, fmtDate } from "../helpers";

interface JobHistoryProps {
  jobs: WakeWordJob[];
  activeJob: WakeWordJob | null;
  fetchJobs: () => void;
  deployJob: (id: number) => void;
  syncJob: (id: number) => void;
}

export function JobHistory({ jobs, activeJob, fetchJobs, deployJob, syncJob }: JobHistoryProps) {
  const isActive = (s: string) => ["queued", "uploading", "running", "downloading"].includes(s);

  return (
    <section id="history" className="border-t border-border pt-8 scroll-mt-28">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <span className="text-primary font-mono text-sm">{activeJob ? "[04]" : "[03]"}</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">job history</h2>
        </div>
        <button
          onClick={fetchJobs}
          className="px-3 py-1 border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-primary hover:text-primary transition-colors"
        >
          REFRESH
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="border border-border bg-card/20 p-8 flex items-center justify-center">
          <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest">[ No training jobs yet ]</span>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-0 border-b border-border bg-muted/20 px-4 py-2">
            {["ID", "Phrase", "Quality", "Backend", "Status", "Recall", "FPPH", "Created", "Actions"].map((h, i) => (
              <div key={h} className={`font-mono text-[10px] text-muted-foreground uppercase ${i === 1 ? "col-span-2" : i === 7 ? "col-span-2" : ""}`}>
                {h}
              </div>
            ))}
          </div>

          {jobs.map(job => (
            <div key={job.id} className="grid grid-cols-12 gap-0 border-b border-border/50 px-4 py-3 hover:bg-muted/10 transition-colors items-center">
              <div className="font-mono text-xs text-muted-foreground">#{job.id}</div>
              <div className="col-span-2 font-mono text-xs text-foreground uppercase truncate">{job.wake_phrase}</div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase">{job.quality}</div>
              <div className="font-mono text-[10px] text-muted-foreground uppercase">
                {job.backend === "local_agx" ? "AGX" : "KAGGLE"}
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot s={job.status} />
                <span className={`font-mono text-[10px] uppercase ${statusColor(job.status)}`}>
                  {job.status}
                </span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {job.recall ? `${(job.recall * 100).toFixed(1)}%` : "—"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {job.fpph ? job.fpph.toFixed(2) : "—"}
              </div>
              <div className="col-span-2 font-mono text-[10px] text-muted-foreground">
                {fmtDate(job.created_at)}
              </div>
              <div className="flex items-center gap-2">
                {job.status === "ready" && (
                  <button
                    onClick={() => deployJob(job.id)}
                    className="px-2 py-1 border border-green-400/40 text-green-400 font-mono text-[10px] uppercase hover:bg-green-400/10 transition-colors"
                  >
                    DEPLOY
                  </button>
                )}
                {job.backend === "kaggle" && isActive(job.status) && (
                  <button
                    onClick={() => syncJob(job.id)}
                    className="px-2 py-1 border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-primary hover:text-primary transition-colors"
                  >
                    SYNC
                  </button>
                )}
                {job.error_message && (
                  <span className="font-mono text-[10px] text-red-400/70 truncate max-w-24" title={job.error_message}>
                    ERR
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
