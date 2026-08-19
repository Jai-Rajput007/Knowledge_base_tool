import { api } from "@/lib/api";
import type { VoiceSettings } from "./types";

export const voiceApi = {
  getVoiceParams: async (): Promise<VoiceSettings> => {
    const res = await api.getVoiceParams();
    return res.data as VoiceSettings;
  },

  saveVoiceParams: async (params: Partial<VoiceSettings>) => {
    const res = await api.saveVoiceParams(params);
    return res.data;
  },
};
