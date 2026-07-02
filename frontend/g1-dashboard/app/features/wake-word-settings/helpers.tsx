import React from "react";
import { JobStatus } from "./types";

export function statusColor(s: JobStatus) {
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

export function StatusDot({ s }: { s: JobStatus }) {
  const pulse = ["running", "uploading", "downloading"].includes(s);
  return (
    <span className="relative flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${pulse ? "animate-pulse bg-yellow-400" : s === "ready" || s === "deployed" ? "bg-green-400" : s === "error" ? "bg-red-400" : "bg-muted-foreground"}`} />
    </span>
  );
}

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export const qualityInfo = {
  draft:      { label: "DRAFT",      samples: "5,000",  steps: "30k" },
  standard:   { label: "STANDARD",   samples: "10,000", steps: "50k" },
  production: { label: "PRODUCTION", samples: "25,000", steps: "100k" },
};
