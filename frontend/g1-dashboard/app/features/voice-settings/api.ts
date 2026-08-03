import { api } from "@/lib/api";

export interface VoiceModel {
  filename: string;
  name: string;
  path: string;
  size_kb: number;
  modified: string;
}

export const voiceApi = {
  getAvailableVoices: async () => {
    const res = await api.get<{ models: VoiceModel[] }>("/settings/voices");
    return res.data;
  },
  
  saveVoiceSelection: async (voice_model: string) => {
    const res = await api.put("/settings/voices", { voice_model });
    return res.data;
  }
};
