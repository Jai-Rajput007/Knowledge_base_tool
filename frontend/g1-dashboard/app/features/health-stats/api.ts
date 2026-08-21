import { api, API_BASE_URL } from "@/lib/api";
import type { TelemetryResponse } from "./types";

export async function fetchTelemetry(): Promise<TelemetryResponse> {
  const token = api.getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/health/telemetry`, { headers });
  if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.status}`);
  return res.json();
}
