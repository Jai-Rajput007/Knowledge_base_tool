import useSWR from "swr";
import { voiceApi } from "./api";
import { useState } from "react";

export const useAvailableVoices = () => {
  return useSWR("voices_available", () => voiceApi.getAvailableVoices());
};

export const useUpdateVoiceSelection = () => {
  const [isPending, setIsPending] = useState(false);
  
  const mutateAsync = async (voice_model: string) => {
    setIsPending(true);
    try {
      await voiceApi.saveVoiceSelection(voice_model);
    } finally {
      setIsPending(false);
    }
  };
  
  return { mutateAsync, isPending };
};
