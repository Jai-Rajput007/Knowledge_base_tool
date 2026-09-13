// Types for vlm-vision

/** The robot's VLM ("look_through_camera") tool config, as robot_sync reports it. */
export interface VisionConfig {
  enabled: boolean;
  model: string;
  ollama_url: string;
  snapshot_url: string;
  timeout_s: number;
  num_predict: number;
  max_side: number;
  filler: Record<string, string>;
}
