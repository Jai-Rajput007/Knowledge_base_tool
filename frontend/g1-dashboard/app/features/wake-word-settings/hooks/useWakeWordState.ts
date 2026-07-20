import { useState, useEffect, useRef, useCallback } from "react";
import { WakeWordJob, LocalStatus } from "../types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export function useWakeWordState() {
  const [phrase, setPhrase] = useState("");
  const [quality, setQuality] = useState<"draft" | "standard" | "production">("draft");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const [maintStatus, setMaintStatus] = useState<{ maintenance_mode: boolean; pipeline_running: boolean } | null>(null);
  const [maintLoading, setMaintLoading] = useState(false);

  const [jobs, setJobs] = useState<WakeWordJob[]>([]);
  const [activeJob, setActiveJob] = useState<WakeWordJob | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);

  const [backend, setBackend] = useState<string>("local_agx");
  const [agxIp, setAgxIp] = useState<string>("");

  const logRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const fetchJobs = useCallback(async () => {
    const r = await fetch(`${API}/wakeword/jobs`);
    if (!r.ok) return;
    const d = await r.json();
    setJobs(d.jobs ?? []);
    setActiveJob(d.active ?? null);
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const r = await fetch(`${API}/wakeword/presets`);
      if (r.ok) {
        const d = await r.json();
        // Backend/AGX IP come from the backend config
        if (d.backend) setBackend(d.backend);
        if (d.agx_ip) setAgxIp(d.agx_ip);
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

  useEffect(() => {
    fetchJobs();
    fetchPresets();
  }, [fetchJobs, fetchPresets]);

  useEffect(() => {
    // Backend configuration is now properly set by fetchPresets.
    // No longer guessing from historical jobs.
  }, [jobs]);

  useEffect(() => {
    if (agxIp) fetchMaintStatus(agxIp);
  }, [agxIp, fetchMaintStatus]);

  useEffect(() => {
    if (!activeJob) return;
    const interval = setInterval(() => {
      fetchJobs();
      if (activeJob.backend === "local_agx") fetchLocalStatus(activeJob.id);
    }, 30000);
    if (activeJob.backend === "local_agx") fetchLocalStatus(activeJob.id);
    return () => clearInterval(interval);
  }, [activeJob, fetchJobs, fetchLocalStatus]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

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

  return {
    phrase, setPhrase, quality, setQuality, files, setFiles,
    submitting, submitMsg,
    maintStatus, maintLoading, toggleMaintenance,
    jobs, activeJob, localStatus, backend, agxIp,
    logRef, logs,
    startTraining, deployJob, cancelJob, syncJob,
    fetchJobs, fetchLocalStatus
  };
}
