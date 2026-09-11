"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { voiceStudioApi } from "../api";
import type { StudioVoice } from "../types";

/** Language picker state, defaulting to the robot's active language. */
export function useStudioLanguage() {
  const [language, setLanguage] = useState("en");
  useEffect(() => {
    voiceStudioApi.robotLanguage().then(setLanguage).catch(() => setLanguage("en"));
  }, []);
  return [language, setLanguage] as const;
}

/** The voice the robot will use for `language` right now (re-read on focus, since Settings may change it). */
export function useStudioVoice(language: string) {
  return useSWR<StudioVoice>(["voice-studio-voice", language], () => voiceStudioApi.voice(language), {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
}
