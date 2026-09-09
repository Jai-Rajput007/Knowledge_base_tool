export interface EnglishVoiceSettings {
  voice: string;
  speed: number;
  gain: number;
}

export interface IndicVoiceSettings {
  pace: number;
  temperature: number;
  gain: number;
  language_voices: Record<string, string>;
}

export interface OmniVoiceSettings {
  default_voice: "male" | "female";
  num_step: number;
  gain: number;
  language_voices: Record<string, "male" | "female">;
}

export interface InternationalVoiceSettings {
  kokoro_language_voices: Record<string, string>;
  omnivoice: OmniVoiceSettings;
}

export interface VoiceSettings {
  english: EnglishVoiceSettings;
  indic: IndicVoiceSettings;
  international: InternationalVoiceSettings;
}

export interface KokoroVoice {
  id: string;
  label: string;
  gender: "female" | "male";
  accent: "american" | "british";
}

export interface SarvamLanguage {
  code: string;
  label: string;
  nativeLabel: string;
  voices: { id: string; label: string; gender: "male" | "female" }[];
}
