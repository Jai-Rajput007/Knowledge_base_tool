const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function fetchJobsApi() {
  const r = await fetch(`${API}/wakeword/jobs`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function fetchPresetsApi() {
  const r = await fetch(`${API}/wakeword/presets`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function fetchMaintStatusApi(ip: string) {
  const r = await fetch(`${API}/wakeword/robot/${ip}/status`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function fetchLocalStatusApi(jobId: number) {
  const r = await fetch(`${API}/wakeword/jobs/${jobId}/local-status`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function toggleMaintenanceApi(ip: string, action: "start" | "stop") {
  const r = await fetch(`${API}/wakeword/robot/${ip}/maintenance/${action}`, { method: "POST" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function startTrainingApi(form: FormData) {
  const r = await fetch(`${API}/wakeword/train`, { method: "POST", body: form });
  return r.json();
}

export async function deployJobApi(jobId: number) {
  const r = await fetch(`${API}/wakeword/jobs/${jobId}/deploy`, { method: "POST" });
  return r.json();
}

export async function cancelJobApi(jobId: number, isLocal: boolean) {
  const url = isLocal
    ? `${API}/wakeword/jobs/${jobId}/local-cancel`
    : `${API}/wakeword/jobs/${jobId}`;
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export async function syncJobApi(jobId: number) {
  const r = await fetch(`${API}/wakeword/jobs/${jobId}/sync`, { method: "POST" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}
