import useSWR from "swr";
import { useState } from "react";
import { voiceApi } from "./api";
import type { VoiceSettings } from "./types";

export const useVoiceParams = () => {
  return useSWR<VoiceSettings>("voice_params", voiceApi.getVoiceParams, {
    revalidateOnFocus: false,
  });
};

export const useSaveVoiceParams = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (params: Partial<VoiceSettings>) => {
    setIsPending(true);
    setError(null);
    try {
      const result = await voiceApi.saveVoiceParams(params);
      return result;
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
      throw e;
    } finally {
      setIsPending(false);
    }
  };

  return { save, isPending, error };
};
