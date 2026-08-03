import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { voiceApi } from "./api";

export const useAvailableVoices = () => {
  return useQuery({
    queryKey: ["voices", "available"],
    queryFn: () => voiceApi.getAvailableVoices(),
  });
};

export const useUpdateVoiceSelection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (voice_model: string) => voiceApi.saveVoiceSelection(voice_model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voices"] });
    },
  });
};
