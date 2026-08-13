"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";

const SUPPORTED_LANGUAGES = [
  { id: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { id: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { id: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
  { id: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { id: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { id: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { id: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
  { id: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { id: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { id: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
];

export function LanguageSettingsModule() {
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

  const handleLanguageSelect = async (langId: string) => {
    if (langId === activeLang) return;
    
    setIsSaving(langId);
    
    try {
      const res = await api.saveLanguage(langId);
      if (res.error) throw new Error(res.error);
      
      setActiveLang(langId);
      
      if (typeof toast !== 'undefined') {
        toast.success("Language updated successfully", {
          description: `Robot primary language set to ${SUPPORTED_LANGUAGES.find(l => l.id === langId)?.name}.`
        });
      }
    } catch (error) {
      console.error("Failed to update language:", error);
      if (typeof toast !== 'undefined') {
        toast.error("Failed to update language");
      }
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
        {SUPPORTED_LANGUAGES.map((lang) => {
          const isActive = activeLang === lang.id;
          const isCurrentlySaving = isSaving === lang.id;
          
          return (
            <button
              key={lang.id}
              onClick={() => handleLanguageSelect(lang.id)}
              disabled={isSaving !== null}
              className={cn(
                "relative flex items-start gap-4 p-5 rounded-xl border text-left transition-all duration-200 overflow-hidden",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                isActive 
                  ? "border-primary bg-primary/5 shadow-sm" 
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
                isSaving !== null && !isCurrentlySaving && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Premium gradient glow effect for active state */}
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
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn("font-medium truncate", isActive ? "text-primary" : "text-foreground")}>
                    {lang.name}
                  </h3>
                  {isActive && !isCurrentlySaving && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
                      Active
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
        <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground font-medium block mb-1">Dynamic Speech Models</strong>
          When switching languages, the robot automatically hot-swaps to the optimal speech-to-text (ASR) and text-to-speech (TTS) models for that region. For instance, selecting Hindi routes speech via the highly accurate Indic-Conformer and Sarvam TTS endpoints.
        </div>
      </div>
    </div>
  );
}
