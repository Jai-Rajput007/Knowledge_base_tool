import React from "react";
import { WakeWordJob } from "../types";
import { StatusDot, statusColor } from "../helpers";

interface SystemStatusProps {
  backend: string;
  agxIp: string;
  maintStatus: { maintenance_mode: boolean; pipeline_running: boolean } | null;
  activeJob: WakeWordJob | null;
  maintLoading: boolean;
  toggleMaintenance: () => void;
}

export function SystemStatus({
  backend, agxIp, maintStatus, activeJob, maintLoading, toggleMaintenance
}: SystemStatusProps) {
  return (
    <section id="status" className="border-t border-border pt-8 scroll-mt-28">
      <div className="flex items-center gap-4 mb-8">
        <span className="text-primary font-mono text-sm">[01]</span>
        <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">system status</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Backend */}
        <div className="border border-border bg-card/50 p-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// training backend</p>
          <p className="text-lg font-mono font-bold text-primary uppercase">
            {backend === "local_agx" ? "LOCAL AGX" : "KAGGLE CLOUD"}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            {backend === "local_agx" ? `AGX IP: ${agxIp || "not detected"}` : "kaggle.com free GPU"}
          </p>
        </div>

        {/* Robot status */}
        <div className="border border-border bg-card/50 p-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// robot pipeline</p>
          {maintStatus ? (
            <>
              <p className={`text-lg font-mono font-bold uppercase ${maintStatus.maintenance_mode ? "text-yellow-400" : maintStatus.pipeline_running ? "text-green-400" : "text-muted-foreground"}`}>
                {maintStatus.maintenance_mode ? "MAINTENANCE" : maintStatus.pipeline_running ? "RUNNING" : "STOPPED"}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                {maintStatus.maintenance_mode ? "GPU free for training" : "NLP pipeline active"}
              </p>
            </>
          ) : (
            <p className="text-lg font-mono font-bold text-muted-foreground uppercase">UNKNOWN</p>
          )}
        </div>

        {/* Active job */}
        <div className="border border-border bg-card/50 p-4">
          <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">// active job</p>
          {activeJob ? (
            <>
              <div className="flex items-center gap-2">
                <StatusDot s={activeJob.status} />
                <p className={`text-lg font-mono font-bold uppercase ${statusColor(activeJob.status)}`}>
                  {activeJob.status.toUpperCase()}
                </p>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                "{activeJob.wake_phrase}" — job #{activeJob.id}
              </p>
            </>
          ) : (
            <p className="text-lg font-mono font-bold text-muted-foreground uppercase">IDLE</p>
          )}
        </div>
      </div>

      {/* Maintenance toggle — only for local_agx */}
      {backend === "local_agx" && agxIp && (
        <div className="mt-4 border border-border bg-card/30 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-foreground uppercase">Robot Maintenance Mode</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
              Must be ON before training. Stops NLP pipeline to free GPU.
            </p>
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={maintLoading || !!activeJob}
            className={`px-4 py-2 text-xs font-mono uppercase border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              ${maintStatus?.maintenance_mode
                ? "border-yellow-400/50 text-yellow-400 hover:bg-yellow-400/10"
                : "border-green-400/50 text-green-400 hover:bg-green-400/10"
              }`}
          >
            {maintLoading ? "..." : maintStatus?.maintenance_mode ? "[ STOP MAINTENANCE ]" : "[ START MAINTENANCE ]"}
          </button>
        </div>
      )}
    </section>
  );
}
