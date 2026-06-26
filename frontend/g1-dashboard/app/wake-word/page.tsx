"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus =
  | "queued" | "uploading" | "running" | "downloading" | "ready"
  | "deployed" | "cancelled" | "error";

interface WakeWordJob {
  id: number;
  wake_phrase: string;
  model_name: string;
  backend: string;
  robot_ip: string | null;
  quality: string;
  steps: number;
  n_samples: number;
  sample_count: number;
  status: JobStatus;
  optimal_threshold: number | null;
  recall: number | null;
  fpph: number | null;
  onnx_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface LocalStatus {
  db_status: string;
  agx_live: {
    status: string;
    step: number;
    total_steps: number;
    message: string;
    log_tail?: string[];
  };
  progress_pct: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: JobStatus) {
  const map: Record<string, string> = {
    running: "text-yellow-400",
    uploading: "text-yellow-400",
    downloading: "text-yellow-400",
    ready: "text-green-400",
    deployed: "text-green-400",
    error: "text-red-400",
    cancelled: "text-muted-foreground",
    queued: "text-blue-400",
  };
  return map[s] ?? "text-muted-foreground";
}

function statusDot(s: JobStatus) {
  const pulse = ["running", "uploading", "downloading"].includes(s);
  return (
    <span className="relative flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${pulse ? "animate-pulse bg-yellow-400" : s === "ready" || s === "deployed" ? "bg-green-400" : s === "error" ? "bg-red-400" : "bg-muted-foreground"}`} />
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WakeWordPage() {
  // Training form
  const [phrase, setPhrase] = useState("");
  const [quality, setQuality] = useState<"draft" | "standard" | "production">("draft");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  // Maintenance
  const [maintStatus, setMaintStatus] = useState<{ maintenance_mode: boolean; pipeline_running: boolean } | null>(null);
  const [maintLoading, setMaintLoading] = useState(false);

  // Jobs
  const [jobs, setJobs] = useState<WakeWordJob[]>([]);
  const [activeJob, setActiveJob] = useState<WakeWordJob | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);

  // Config
  const [backend, setBackend] = useState<string>("local_agx");
  const [agxIp, setAgxIp] = useState<string>("");

  // Log stream
  const logRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    const r = await fetch(`${API}/wakeword/jobs`);
    if (!r.ok) return;
    const d = await r.json();
    setJobs(d.jobs ?? []);
    setActiveJob(d.active ?? null);
  }, []);

  const fetchPresets = useCallback(async () => {
    // Also get backend config from presets endpoint (includes backend info)
    try {
      const r = await fetch(`${API}/wakeword/presets`);
      if (r.ok) {
        // Backend/AGX IP come from the backend config — shown in the UI as read-only
      }
    } catch { /* no op */ }
  }, []);

  const fetchMaintStatus = useCallback(async (ip: string) => {
    if (!ip) return;
    try {
      const r = await fetch(`${API}/wakeword/robot/${ip}/status`);
      if (r.ok) setMaintStatus(await r.json());
    } catch { setMaintStatus(null); }
  }, []);

  const fetchLocalStatus = useCallback(async (jobId: number) => {
    try {
      const r = await fetch(`${API}/wakeword/jobs/${jobId}/local-status`);
      if (r.ok) {
        const d: LocalStatus = await r.json();
        setLocalStatus(d);
        if (d.agx_live?.log_tail) {
          setLogs(d.agx_live.log_tail);
        }
      }
    } catch { /* no op */ }
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchJobs();
    fetchPresets();
  }, [fetchJobs, fetchPresets]);

  // Detect AGX IP from active or most recent local_agx job
  useEffect(() => {
    const localJob = jobs.find(j => j.backend === "local_agx" && j.robot_ip);
    if (localJob?.robot_ip) {
      setAgxIp(localJob.robot_ip);
      setBackend("local_agx");
    } else if (jobs.some(j => j.backend === "kaggle")) {
      setBackend("kaggle");
    }
  }, [jobs]);

  useEffect(() => {
    if (agxIp) fetchMaintStatus(agxIp);
  }, [agxIp, fetchMaintStatus]);

  // Poll active job every 30s
  useEffect(() => {
    if (!activeJob) return;
    const interval = setInterval(() => {
      fetchJobs();
      if (activeJob.backend === "local_agx") fetchLocalStatus(activeJob.id);
    }, 30000);
    if (activeJob.backend === "local_agx") fetchLocalStatus(activeJob.id);
    return () => clearInterval(interval);
  }, [activeJob, fetchJobs, fetchLocalStatus]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function toggleMaintenance() {
    if (!agxIp) return;
    setMaintLoading(true);
    const action = maintStatus?.maintenance_mode ? "stop" : "start";
    const r = await fetch(`${API}/wakeword/robot/${agxIp}/maintenance/${action}`, { method: "POST" });
    setMaintLoading(false);
    if (r.ok) fetchMaintStatus(agxIp);
  }

  async function startTraining() {
    if (!phrase.trim()) { setSubmitMsg("Enter a wake phrase first."); return; }
    setSubmitting(true);
    setSubmitMsg("");
    setLogs([]);

    const form = new FormData();
    form.append("wake_phrase", phrase.trim());
    form.append("quality", quality);
    for (const f of files) form.append("samples", f);

    const r = await fetch(`${API}/wakeword/train`, { method: "POST", body: form });
    const d = await r.json();
    setSubmitting(false);

    if (!r.ok) {
      setSubmitMsg(d.detail ?? "Failed to start training.");
      return;
    }
    setSubmitMsg(`Job #${d.job_id} started — ${d.estimated_minutes} min estimated.`);
    setPhrase("");
    setFiles([]);
    fetchJobs();
  }

  async function deployJob(jobId: number) {
    const r = await fetch(`${API}/wakeword/jobs/${jobId}/deploy`, { method: "POST" });
    const d = await r.json();
    if (r.ok) {
      alert(`Deployed!\n\nAdd to app_config.json:\n${JSON.stringify(d.robot_config, null, 2)}`);
      fetchJobs();
    } else {
      alert(d.detail ?? "Deploy failed.");
    }
  }

  async function cancelJob(jobId: number, isLocal: boolean) {
    const url = isLocal
      ? `${API}/wakeword/jobs/${jobId}/local-cancel`
      : `${API}/wakeword/jobs/${jobId}`;
    await fetch(url, { method: "DELETE" });
    fetchJobs();
  }

  async function syncJob(jobId: number) {
    await fetch(`${API}/wakeword/jobs/${jobId}/sync`, { method: "POST" });
    fetchJobs();
  }

  // ── Quality descriptions ───────────────────────────────────────────────────
  const qualityInfo = {
    draft:      { label: "DRAFT",      time: backend === "local_agx" ? "2-3 hrs" : "1.5 hrs", samples: "5,000",  steps: "30k" },
    standard:   { label: "STANDARD",   time: backend === "local_agx" ? "4-6 hrs" : "2.5 hrs", samples: "10,000", steps: "50k" },
    production: { label: "PRODUCTION", time: backend === "local_agx" ? "8-12 hrs": "4.5 hrs", samples: "25,000", steps: "100k" },
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isActive = (s: JobStatus) =>
    ["queued", "uploading", "running", "downloading"].includes(s);

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">

      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Wake Word
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Train and deploy custom wake word models
        </p>
      </div>

      {/* [01] System Status */}
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
                  {statusDot(activeJob.status)}
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

      {/* [02] Train New Wake Word */}
      <section id="train" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[02]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">train new wake word</h2>
        </div>

        <div className="border border-border bg-card/50 p-6 space-y-6">
          <p className="text-xs font-mono text-muted-foreground uppercase">// training configuration</p>

          {/* Wake phrase input */}
          <div>
            <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-2">
              Wake Phrase
            </label>
            <input
              type="text"
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              placeholder="e.g. hey jai"
              disabled={!!activeJob}
              className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary disabled:opacity-40 uppercase"
            />
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              2-3 words work best. Avoid common phrases.
            </p>
          </div>

          {/* Quality selector */}
          <div>
            <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-3">
              Training Quality
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["draft", "standard", "production"] as const).map(q => {
                const info = qualityInfo[q];
                return (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    disabled={!!activeJob}
                    className={`border p-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                      ${quality === q
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <p className="font-mono text-xs font-bold uppercase">{info.label}</p>
                    <p className="font-mono text-[10px] mt-2 opacity-70">{info.steps} steps</p>
                    <p className="font-mono text-[10px] opacity-70">{info.samples} clips</p>
                    <p className="font-mono text-[10px] mt-1 text-primary/70">~{info.time}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample upload */}
          <div>
            <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-2">
              Audio Samples (optional but recommended)
            </label>
            <div className="border border-dashed border-border/50 p-6 text-center">
              <input
                type="file"
                accept=".wav,.mp3,.m4a"
                multiple
                onChange={e => setFiles(Array.from(e.target.files ?? []))}
                disabled={!!activeJob}
                className="hidden"
                id="sample-upload"
              />
              <label htmlFor="sample-upload" className={`cursor-pointer ${activeJob ? "opacity-40 cursor-not-allowed" : ""}`}>
                <p className="font-mono text-xs text-muted-foreground uppercase">
                  {files.length > 0
                    ? `${files.length} file(s) selected`
                    : "[ DROP WAV FILES OR CLICK TO UPLOAD ]"
                  }
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/50 mt-2">
                  50+ recordings = better Indian accent accuracy (85-95% recall)
                </p>
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                {files.map((f, i) => (
                  <p key={i} className="font-mono text-[10px] text-muted-foreground">
                    ▸ {f.name} ({(f.size / 1024).toFixed(0)} KB)
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Maintenance warning for local_agx */}
          {backend === "local_agx" && !maintStatus?.maintenance_mode && (
            <div className="border border-yellow-400/30 bg-yellow-400/5 p-3">
              <p className="font-mono text-[10px] text-yellow-400 uppercase">
                ⚠ Robot not in maintenance mode — enable it above before training
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              onClick={startTraining}
              disabled={submitting || !!activeJob || (backend === "local_agx" && !maintStatus?.maintenance_mode)}
              className="px-6 py-3 border border-primary text-primary font-mono text-xs uppercase hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "[ STARTING... ]" : "[ START TRAINING ]"}
            </button>
            {activeJob && (
              <p className="font-mono text-[10px] text-yellow-400 uppercase">
                Job #{activeJob.id} already running — wait or cancel it
              </p>
            )}
          </div>

          {submitMsg && (
            <p className={`font-mono text-xs uppercase ${submitMsg.includes("failed") || submitMsg.includes("Enter") ? "text-red-400" : "text-green-400"}`}>
              {submitMsg}
            </p>
          )}
        </div>
      </section>

      {/* [03] Live Training Progress */}
      {activeJob && (
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
            {/* Status + phrase */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusDot(activeJob.status)}
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

            {/* Progress bar (local_agx) */}
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

            {/* Step indicators */}
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

            {/* Log tail */}
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
      )}

      {/* [04] Job History */}
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
            {/* Table header */}
            <div className="grid grid-cols-12 gap-0 border-b border-border bg-muted/20 px-4 py-2">
              {["ID", "Phrase", "Quality", "Backend", "Status", "Recall", "FPPH", "Created", "Actions"].map((h, i) => (
                <div key={h} className={`font-mono text-[10px] text-muted-foreground uppercase ${i === 1 ? "col-span-2" : i === 7 ? "col-span-2" : ""}`}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {jobs.map(job => (
              <div key={job.id} className="grid grid-cols-12 gap-0 border-b border-border/50 px-4 py-3 hover:bg-muted/10 transition-colors items-center">
                <div className="font-mono text-xs text-muted-foreground">#{job.id}</div>
                <div className="col-span-2 font-mono text-xs text-foreground uppercase truncate">{job.wake_phrase}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase">{job.quality}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase">
                  {job.backend === "local_agx" ? "AGX" : "KAGGLE"}
                </div>
                <div className="flex items-center gap-1.5">
                  {statusDot(job.status)}
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

      {/* Quick reference */}
      <section className="border-t border-border pt-8">
        <p className="text-[10px] font-mono text-muted-foreground uppercase mb-4">// sample count guide</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { samples: "0 recordings", recall: "60-75%", note: "TTS only, US accent" },
            { samples: "20-50 recordings", recall: "85-90%", note: "Good for most sites" },
            { samples: "100+ recordings", recall: "90-95%", note: "Multi-speaker, noisy envs" },
          ].map(r => (
            <div key={r.samples} className="border border-border/50 p-4">
              <p className="font-mono text-xs text-foreground uppercase">{r.samples}</p>
              <p className="font-mono text-lg font-bold text-primary mt-1">{r.recall}</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">{r.note}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
