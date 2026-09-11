import { api } from "@/lib/api";
import type { StudioStatus, StudioVoice } from "./types";

/** Backend errors arrive as raw text like {"detail":"..."} — surface just the message. */
function unwrap<T>(res: { data?: T; error?: string }): T {
  if (res.error) {
    let message = res.error;
    try {
      const parsed = JSON.parse(res.error);
      if (typeof parsed?.detail === "string") message = parsed.detail;
    } catch {
      /* plain-text error */
    }
    throw new Error(message);
  }
  return res.data as T;
}

export const voiceStudioApi = {
  play: async (items: { id: string; text: string }[], language: string) =>
    unwrap<StudioStatus>(await api.voiceStudioPlay(items, language)),

  pause: async () => unwrap<StudioStatus>(await api.voiceStudioControl("pause")),
  resume: async () => unwrap<StudioStatus>(await api.voiceStudioControl("resume")),
  stop: async () => unwrap<StudioStatus>(await api.voiceStudioControl("stop")),

  status: async () => unwrap<StudioStatus>(await api.voiceStudioStatus()),

  voice: async (language: string) => unwrap<StudioVoice>(await api.voiceStudioVoice(language)),

  /** Robot's active language (admin-only endpoint — editors fall back to English). */
  robotLanguage: async (): Promise<string> => {
    const res = await api.getLanguage();
    return res.data?.language ?? "en";
  },
};
