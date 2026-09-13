// API for communication-gestures — proxies through the backend's
// /gestures/communication endpoints (backend/app/api/v1/endpoints/gestures.py),
// which resolve tenant-logical gesture names to on-disk names, ensure each
// selected recording is actually on the robot, and merge the set into
// app_config.json on the Thor via robot_sync (no restart required).

import { api, API_BASE_URL } from "@/lib/api";
import type { CommunicationMode, CommunicationSet, UnitreeRoles, UnitreeVerifyResult } from "./types";

const API = API_BASE_URL;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = api.getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extra || {}) };
}

export async function getCommunicationSet(): Promise<CommunicationSet> {
  const res = await fetch(`${API}/gestures/communication`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET /gestures/communication failed (${res.status})`);
  return res.json();
}

export async function putCommunicationSet(
  body: Pick<CommunicationSet, "enabled" | "mode" | "names" | "unitree_roles"> & { min_reply_chars?: number }
): Promise<CommunicationSet> {
  const res = await fetch(`${API}/gestures/communication`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `PUT /gestures/communication failed (${res.status})`);
  }
  return res.json();
}

export async function testCommunicationSet(
  mode: CommunicationMode,
  namesOrRoles: string[] | UnitreeRoles,
  seconds = 10
): Promise<{ status: string; mode: CommunicationMode; seconds: number }> {
  const body =
    mode === "unitree_app"
      ? { mode, unitree_roles: namesOrRoles as UnitreeRoles, seconds }
      : { mode, names: namesOrRoles as string[], seconds };
  const res = await fetch(`${API}/gestures/communication/test`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `POST /gestures/communication/test failed (${res.status})`);
  }
  return res.json();
}

/**
 * Confirms that 3 gestures taught through the Unitree app's "demo teaching" feature
 * actually exist on the robot — there's no way to list them, so this briefly fires each
 * one (~400ms) and reports whether the robot accepted it. Necessarily moves the arm.
 */
export async function verifyUnitreeRoles(roles: UnitreeRoles): Promise<UnitreeVerifyResult> {
  const res = await fetch(`${API}/gestures/communication/verify`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ unitree_roles: roles }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `POST /gestures/communication/verify failed (${res.status})`);
  }
  return res.json();
}
