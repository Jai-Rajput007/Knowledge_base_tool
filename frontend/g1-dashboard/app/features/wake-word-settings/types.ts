export type JobStatus =
  | "queued" | "uploading" | "running" | "downloading" | "ready"
  | "deployed" | "cancelled" | "error";

export interface WakeWordJob {
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

export interface LocalStatus {
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
