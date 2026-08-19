"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import {
  FiVolume2, FiZap, FiWind, FiThermometer, FiSave, FiRefreshCw,
  FiCheck, FiChevronDown, FiUser, FiUsers,
} from "react-icons/fi";
import { useVoiceParams, useSaveVoiceParams } from "./hooks";
import type { KokoroVoice, SarvamLanguage, VoiceSettings } from "./types";

// ── Kokoro English voices (American + British, female + male) ──────────────
const KOKORO_VOICES: KokoroVoice[] = [
  { id: "af_heart",   label: "Heart",    gender: "female", accent: "american" },
  { id: "af_bella",   label: "Bella",    gender: "female", accent: "american" },
  { id: "af_nicole",  label: "Nicole",   gender: "female", accent: "american" },
  { id: "af_sarah",   label: "Sarah",    gender: "female", accent: "american" },
  { id: "af_sky",     label: "Sky",      gender: "female", accent: "american" },
  { id: "am_adam",    label: "Adam",     gender: "male",   accent: "american" },
  { id: "am_michael", label: "Michael",  gender: "male",   accent: "american" },
  { id: "am_puck",    label: "Puck",     gender: "male",   accent: "american" },
  { id: "am_echo",    label: "Echo",     gender: "male",   accent: "american" },
  { id: "bm_george",  label: "George",   gender: "male",   accent: "british"  },
  { id: "bm_lewis",   label: "Lewis",    gender: "male",   accent: "british"  },
  { id: "bf_emma",    label: "Emma",     gender: "female", accent: "british"  },
  { id: "bf_isabella",label: "Isabella", gender: "female", accent: "british"  },
];

// ── Sarvam bulbul:v3 — documented best voice per language (M + F) ──────────
const SARVAM_LANGUAGES: SarvamLanguage[] = [
  { code: "hi", label: "Hindi",     nativeLabel: "हिंदी",    voices: [{ id: "shubh",    label: "Shubh",    gender: "male" }, { id: "maya",    label: "Maya",    gender: "female" }] },
  { code: "ta", label: "Tamil",     nativeLabel: "தமிழ்",    voices: [{ id: "ratan",    label: "Ratan",    gender: "male" }, { id: "nila",    label: "Nila",    gender: "female" }] },
  { code: "te", label: "Telugu",    nativeLabel: "తెలుగు",   voices: [{ id: "rohan",    label: "Rohan",    gender: "male" }, { id: "pavithra",label: "Pavithra",gender: "female" }] },
  { code: "gu", label: "Gujarati",  nativeLabel: "ગુજરાતી",  voices: [{ id: "aarav",    label: "Aarav",    gender: "male" }, { id: "priya",   label: "Priya",   gender: "female" }] },
  { code: "bn", label: "Bengali",   nativeLabel: "বাংলা",    voices: [{ id: "kabir",    label: "Kabir",    gender: "male" }, { id: "ritu",    label: "Ritu",    gender: "female" }] },
  { code: "kn", label: "Kannada",   nativeLabel: "ಕನ್ನಡ",   voices: [{ id: "chetan",   label: "Chetan",   gender: "male" }, { id: "ishita",  label: "Ishita",  gender: "female" }] },
  { code: "ml", label: "Malayalam", nativeLabel: "മലയാളം",   voices: [{ id: "anand",    label: "Anand",    gender: "male" }, { id: "suhani",  label: "Suhani",  gender: "female" }] },
  { code: "mr", label: "Marathi",   nativeLabel: "मराठी",    voices: [{ id: "ashutosh", label: "Ashutosh", gender: "male" }, { id: "mrinal",  label: "Mrinal",  gender: "female" }] },
  { code: "pa", label: "Punjabi",   nativeLabel: "ਪੰਜਾਬੀ",  voices: [{ id: "mani",     label: "Mani",     gender: "male" }, { id: "jasleen", label: "Jasleen", gender: "female" }] },
  { code: "or", label: "Odia",      nativeLabel: "ଓଡ଼ିଆ",   voices: [{ id: "amartya",  label: "Amartya",  gender: "male" }, { id: "neha",    label: "Neha",    gender: "female" }] },
];

const DEFAULT_SETTINGS: VoiceSettings = {
  english: { voice: "af_heart", speed: 1.0, gain: 2.0 },
  indic: {
    pace: 1.0, temperature: 0.6, gain: 5.0,
    language_voices: {
      hi: "shubh", ta: "ratan", te: "rohan", gu: "priya",
      bn: "ritu", kn: "ishita", ml: "suhani", mr: "ashutosh",
      pa: "mani", or: "neha",
    },
  },
};

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, open, onToggle }: {
  icon: React.ElementType; title: string; subtitle: string;
  open: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-5 text-left hover:bg-card/50 transition-colors rounded-xl"
    >
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
          <Icon size={20} />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold uppercase tracking-widest">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <FiChevronDown
        size={16}
        className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function ControlSlider({ label, icon: Icon, value, min, max, step, onChange, format }: {
  label: string; icon: React.ElementType;
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : value.toFixed(2);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-3 p-5 border border-border bg-card/20 rounded-xl hover:bg-card/40 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Icon size={15} />
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-foreground">{label}</span>
        </div>
        <span className="font-mono text-xs bg-muted px-2.5 py-1 rounded-full border border-border text-foreground">
          {display}
        </span>
      </div>
      <div className="relative">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-muted-foreground font-mono">{min}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{max}</span>
      </div>
    </div>
  );
}

function VoiceCard({ voice, selected, onClick }: {
  voice: KokoroVoice; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-start gap-1.5 p-3.5 rounded-xl border transition-all text-left ${
        selected
          ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
          : "border-border bg-card/20 hover:border-primary/40 hover:bg-card/40"
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 text-primary">
          <FiCheck size={13} />
        </span>
      )}
      <span className="font-mono text-sm font-semibold text-foreground">{voice.label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
          voice.gender === "female"
            ? "bg-pink-500/10 text-pink-500"
            : "bg-blue-500/10 text-blue-500"
        }`}>
          {voice.gender === "female" ? "F" : "M"}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase tracking-wider">
          {voice.accent === "british" ? "UK" : "US"}
        </span>
      </div>
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function VoiceSettingsModule() {
  const { data: remoteSettings, isLoading } = useVoiceParams();
  const { save, isPending } = useSaveVoiceParams();

  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [englishOpen, setEnglishOpen] = useState(true);
  const [indicOpen, setIndicOpen] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState("hi");
  const [saved, setSaved] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState<"all" | "female" | "male">("all");

  // Sync from robot once loaded
  useEffect(() => {
    if (remoteSettings) {
      setSettings((prev) => ({
        english: { ...prev.english, ...remoteSettings.english },
        indic: {
          ...prev.indic,
          ...remoteSettings.indic,
          language_voices: {
            ...prev.indic.language_voices,
            ...remoteSettings.indic?.language_voices,
          },
        },
      }));
    }
  }, [remoteSettings]);

  const setEnglish = useCallback((patch: Partial<typeof settings.english>) => {
    setSettings((s) => ({ ...s, english: { ...s.english, ...patch } }));
  }, []);

  const setIndic = useCallback((patch: Partial<typeof settings.indic>) => {
    setSettings((s) => ({ ...s, indic: { ...s.indic, ...patch } }));
  }, []);

  const setLanguageVoice = useCallback((lang: string, voice: string) => {
    setSettings((s) => ({
      ...s,
      indic: {
        ...s.indic,
        language_voices: { ...s.indic.language_voices, [lang]: voice },
      },
    }));
  }, []);

  const handleSave = async () => {
    try {
      await save(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // error surfaced by hook
    }
  };

  const filteredVoices = KOKORO_VOICES.filter(
    (v) => voiceFilter === "all" || v.gender === voiceFilter
  );

  const activeLang = SARVAM_LANGUAGES.find((l) => l.code === activeLanguage)!;
  const currentVoice = settings.indic.language_voices[activeLanguage];

  if (isLoading) {
    return (
      <FeatureGate featureKey="voiceSettings">
        <div className="flex items-center gap-3 p-8 text-muted-foreground font-mono text-sm">
          <FiRefreshCw className="animate-spin" size={16} />
          Loading voice configuration from robot...
        </div>
      </FeatureGate>
    );
  }

  return (
    <FeatureGate featureKey="voiceSettings">
      <div className="space-y-4 max-w-3xl">

        {/* ── English Voice ─────────────────────────────────────────────── */}
        <div className="border border-border rounded-2xl overflow-hidden bg-card/10">
          <SectionHeader
            icon={FiVolume2}
            title="English Voice"
            subtitle="Voice character, speed and volume for English responses"
            open={englishOpen}
            onToggle={() => setEnglishOpen((o) => !o)}
          />

          {englishOpen && (
            <div className="px-5 pb-6 space-y-5 border-t border-border pt-5">

              {/* Voice filter pills */}
              <div className="flex items-center gap-2">
                {(["all", "female", "male"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setVoiceFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider border transition-all ${
                      voiceFilter === f
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {f === "all" ? "All" : f === "female" ? "Female" : "Male"}
                  </button>
                ))}
              </div>

              {/* Voice grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {filteredVoices.map((v) => (
                  <VoiceCard
                    key={v.id}
                    voice={v}
                    selected={settings.english.voice === v.id}
                    onClick={() => setEnglish({ voice: v.id })}
                  />
                ))}
              </div>

              {/* Speed + Gain sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <ControlSlider
                  label="Speech Speed"
                  icon={FiZap}
                  value={settings.english.speed}
                  min={0.5} max={2.0} step={0.05}
                  onChange={(v) => setEnglish({ speed: v })}
                  format={(v) => `${v.toFixed(2)}×`}
                />
                <ControlSlider
                  label="Volume Boost"
                  icon={FiVolume2}
                  value={settings.english.gain}
                  min={1.0} max={4.0} step={0.1}
                  onChange={(v) => setEnglish({ gain: v })}
                  format={(v) => `${v.toFixed(1)}×`}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Indic Language Voice ──────────────────────────────────────── */}
        <div className="border border-border rounded-2xl overflow-hidden bg-card/10">
          <SectionHeader
            icon={FiUsers}
            title="Indic Language Voice"
            subtitle="Per-language voice selection and global pace, expressiveness settings"
            open={indicOpen}
            onToggle={() => setIndicOpen((o) => !o)}
          />

          {indicOpen && (
            <div className="px-5 pb-6 border-t border-border pt-5 space-y-5">

              {/* Language tabs */}
              <div className="flex flex-wrap gap-1.5">
                {SARVAM_LANGUAGES.map((lang) => {
                  const isActive = activeLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setActiveLanguage(lang.code)}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl border transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card/20"
                      }`}
                    >
                      <span className="text-xs font-mono font-semibold">{lang.nativeLabel}</span>
                      <span className="text-[10px] font-mono opacity-70">{lang.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Male / Female voice picker for active language */}
              <div className="p-4 border border-border rounded-xl bg-card/20 space-y-3">
                <div className="flex items-center gap-2">
                  <FiUser size={14} className="text-muted-foreground" />
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {activeLang.label} voice
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {activeLang.voices.map((v) => {
                    const selected = currentVoice === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setLanguageVoice(activeLanguage, v.id)}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card/10 hover:border-primary/40 hover:bg-card/30"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            v.gender === "female"
                              ? "bg-pink-500/15 text-pink-500"
                              : "bg-blue-500/15 text-blue-500"
                          }`}>
                            {v.gender === "female" ? "F" : "M"}
                          </span>
                          <span className="font-mono text-sm font-medium text-foreground">{v.label}</span>
                        </div>
                        {selected && <FiCheck size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Global Indic sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ControlSlider
                  label="Pace"
                  icon={FiZap}
                  value={settings.indic.pace}
                  min={0.5} max={2.0} step={0.05}
                  onChange={(v) => setIndic({ pace: v })}
                  format={(v) => `${v.toFixed(2)}×`}
                />
                <ControlSlider
                  label="Expressiveness"
                  icon={FiThermometer}
                  value={settings.indic.temperature}
                  min={0.1} max={1.0} step={0.05}
                  onChange={(v) => setIndic({ temperature: v })}
                  format={(v) => v.toFixed(2)}
                />
                <ControlSlider
                  label="Volume Boost"
                  icon={FiWind}
                  value={settings.indic.gain}
                  min={1.0} max={6.0} step={0.25}
                  onChange={(v) => setIndic({ gain: v })}
                  format={(v) => `${v.toFixed(2)}×`}
                />
              </div>

              <p className="text-[11px] text-muted-foreground font-mono">
                Pace and expressiveness apply to all Indic languages. Voice selection is saved per language.
              </p>
            </div>
          )}
        </div>

        {/* ── Save bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className={`flex items-center gap-2 px-7 py-3 rounded-xl font-mono text-sm font-semibold uppercase tracking-wider transition-all ${
              saved
                ? "bg-green-500/15 text-green-500 border border-green-500/30"
                : "bg-primary text-primary-foreground hover:opacity-90 hover:-translate-y-0.5 shadow-md"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPending ? (
              <><FiRefreshCw className="animate-spin" size={14} /> Applying...</>
            ) : saved ? (
              <><FiCheck size={14} /> Applied</>
            ) : (
              <><FiSave size={14} /> Save & Apply</>
            )}
          </button>
        </div>
      </div>
    </FeatureGate>
  );
}
