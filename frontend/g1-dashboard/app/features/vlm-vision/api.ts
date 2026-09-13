// API for vlm-vision — proxies through the backend's /vision endpoint
// (backend/app/api/v1/endpoints/vision.py), a thin forward to robot_sync's
// GET/PUT /vision. Toggling `enabled` takes effect on the robot's very next
// reply — vision_service.py re-reads the config fresh on every call, no restart.

import { api, API_BASE_URL } from "@/lib/api";
import type { VisionConfig } from "./types";

const API = API_BASE_URL;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = api.getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extra || {}) };
}

export async function getVisionConfig(): Promise<VisionConfig> {
  const res = await fetch(`${API}/vision/`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET /vision failed (${res.status})`);
  return res.json();
}

export async function putVisionEnabled(enabled: boolean): Promise<VisionConfig> {
  const res = await fetch(`${API}/vision/`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `PUT /vision failed (${res.status})`);
  }
  return res.json();
}
