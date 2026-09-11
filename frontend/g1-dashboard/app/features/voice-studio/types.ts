/**
 * Voice Studio types — mirror g1-nlp/services/voice_studio/player.py status().
 */

export type StudioState = "idle" | "preparing" | "playing" | "paused" | "error";
export type ItemState = "queued" | "playing" | "done" | "stopped" | "error";

export interface StudioVoice {
  language: string;
  provider: "kokoro" | "omnivoice" | "sarvam" | string;
  voice: string;
  gain: number;
  speed?: number;
  pace?: number;
  temperature?: number;
  num_step?: number;
  language_code?: string;
}

export interface StudioStatus {
  session_id: string | null;
  state: StudioState;
  language: string | null;
  voice: StudioVoice | null;
  current_item_id: string | null;
  segment_index: number;
  segment_count: number;
  items: { id: string; state: ItemState }[];
  error: string | null;
  started_at: number | null;
  elapsed_s?: number;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  text: string;
}

/** What the transport bar shows as "now playing" — resolved client-side from ids. */
export interface NowPlaying {
  label: string;
  snippet: string;
}
