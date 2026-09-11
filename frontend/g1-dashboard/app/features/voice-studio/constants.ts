/**
 * Voice Studio constants. Limits mirror robot_sync.py (STUDIO_MAX_ITEMS / STUDIO_MAX_CHARS)
 * so the UI rejects oversize input before the robot does.
 */

export const MAX_ITEMS = 100;
export const MAX_TOTAL_CHARS = 20000;
export const MAX_TXT_FILE_BYTES = 200 * 1024;

export const POLL_ACTIVE_MS = 700;
export const POLL_IDLE_MS = 4000;

/** Playlist persists in this browser only (a per-viewer draft, not shared state). */
export const PLAYLIST_STORAGE_KEY = "voice-studio.playlist.v1";

/** Languages the robot can speak. Which engine/voice is used comes from Settings -> Voice. */
export const STUDIO_LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "zh", label: "Mandarin", native: "中文" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "fr", label: "French", native: "Français" },
  { code: "it", label: "Italian", native: "Italiano" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", label: "Thai", native: "ไทย" },
];

export const PROVIDER_LABELS: Record<string, string> = {
  kokoro: "Kokoro",
  omnivoice: "OmniVoice",
  sarvam: "Sarvam Bulbul",
};

/** Item id used for the one-off text typed in the composer. */
export const COMPOSER_ITEM_ID = "composer";
