"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, Globe2, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { FeatureGate } from "@/app/components/feature-gate";

// Mirrors config/language_config.json on the robot (g1-nlp) — selectable:false
// languages are held back pending an LLM conversational-quality check (outside
// Llama-3.1's officially-evaluated language set), and Thai ships as
// experimental (its ASR sits in Nemotron's "Adaptation-Ready" tier, not yet
// production-ready per NVIDIA's own model card). Keep in sync with that file;
// this list is hardcoded client-side the same way the Indic language list in
// language-settings/index.tsx is.
const INTERNATIONAL_LANGUAGES = [
  { id: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", selectable: true },
  { id: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", selectable: true },
  { id: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", selectable: true },
  { id: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹", selectable: true },
  { id: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", selectable: true },
  { id: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭", selectable: true, experimental: true },
  { id: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", selectable: false },
  { id: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", selectable: false },
  { id: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", selectable: false },
  { id: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", selectable: false },
  { id: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", selectable: false },
  { id: "zh", name: "Mandarin", nativeName: "中文", flag: "🇨🇳", selectable: false },
];

function InternationalLanguageModuleInner() {
  const [activeLang, setActiveLang] = useState<string>("en");
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentLanguage = async () => {
      try {
        const res = await api.getLanguage();
        if (res.data?.language) {
          setActiveLang(res.data.language);
        }
      } catch (error) {
        console.error("Failed to load active language:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCurrentLanguage();
  }, []);

  const handleLanguageSelect = async (langId: string, selectable: boolean) => {
    if (!selectable || langId === activeLang) return;

    setIsSaving(langId);
    try {
      const res = await api.saveLanguage(langId);
      if (res.error) throw new Error(res.error);
      setActiveLang(langId);
    } catch (error) {
      console.error("Failed to update language:", error);
    } finally {
      setIsSaving(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTERNATIONAL_LANGUAGES.map((lang) => {
          const isActive = activeLang === lang.id;
          const isCurrentlySaving = isSaving === lang.id;
          const disabled = !lang.selectable || isSaving !== null;

          return (
            <button
              key={lang.id}
              onClick={() => handleLanguageSelect(lang.id, lang.selectable)}
              disabled={disabled}
              title={!lang.selectable ? "Held pending LLM conversational-quality validation" : undefined}
              className={cn(
                "relative flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-200 overflow-hidden",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                !lang.selectable && "opacity-40 cursor-not-allowed hover:border-border hover:bg-card",
                lang.selectable && isSaving !== null && !isCurrentlySaving && "opacity-50 cursor-not-allowed"
              )}
            >
              {isActive && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              )}

              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border shrink-0 transition-colors",
                isActive ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"
              )}>
                {isCurrentlySaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-xl leading-none" aria-hidden="true">{lang.flag}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className={cn("font-medium truncate", isActive ? "text-primary" : "text-foreground")}>
                    {lang.name}
                  </h3>
                  {isActive && !isCurrentlySaving && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                      Active
                    </span>
                  )}
                  {lang.experimental && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-semibold uppercase tracking-wider">
                      <FlaskConical className="w-2.5 h-2.5" /> Experimental
                    </span>
                  )}
                  {!lang.selectable && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate font-medium">
                  {lang.nativeName}
                </p>
              </div>

              {isActive && !isCurrentlySaving && (
                <div className="absolute top-1/2 right-4 -translate-y-1/2 text-primary">
                  <Check className="w-5 h-5" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-muted/50 rounded-xl p-4 border border-border/50 flex items-start gap-3 mt-6">
        <Globe2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-medium block mb-1">Dynamic Speech Models</strong>
          Switching an international language hot-swaps ASR, LLM instruction, and TTS together —
          the robot always answers in the language you select here, never auto-detected. German,
          French, Italian, Portuguese, and Spanish route through Nemotron ASR and Kokoro TTS;
          Arabic, Russian, Korean, Vietnamese, and Thai route through Nemotron ASR and OmniVoice TTS.
          "Coming soon" languages are already built end-to-end but held back from selection until
          their LLM conversational quality is validated. Voices for these languages are managed in
          the Voice settings tab.
        </div>
      </div>
    </div>
  );
}

export function InternationalLanguageModule() {
  return (
    <FeatureGate featureKey="internationalLanguage" hideWhenDisabled>
      <InternationalLanguageModuleInner />
    </FeatureGate>
  );
}
