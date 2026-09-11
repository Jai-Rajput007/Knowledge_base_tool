"use client";

import Link from "next/link";
import { CircleAlert, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { PROVIDER_LABELS, STUDIO_LANGUAGES } from "../constants";
import type { StudioVoice } from "../types";

interface Props {
  language: string;
  onLanguageChange: (code: string) => void;
  voice: StudioVoice | undefined;
  voiceError: string | null;
  voiceLoading: boolean;
  locked: boolean;
}

function voiceDetail(v: StudioVoice): string {
  const parts = [`gain ${v.gain}`];
  if (v.speed !== undefined) parts.push(`speed ${v.speed}`);
  if (v.pace !== undefined) parts.push(`pace ${v.pace}`);
  if (v.num_step !== undefined) parts.push(`${v.num_step} steps`);
  return parts.join(" · ");
}

/** Title, explicit language lock, and the voice the robot will use (edited in Settings -> Voice). */
export function StudioHeader({ language, onLanguageChange, voice, voiceError, voiceLoading, locked }: Props) {
  return (
    <div className="border-b border-border pb-6 flex items-end justify-between gap-6 flex-wrap">
      <div>
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">Voice Studio</h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          Make the robot say anything — lines, scripts, or a full turn-by-turn playlist
        </p>
      </div>

      <div className="flex items-stretch gap-2 flex-wrap">
        <label className="flex flex-col justify-center rounded-xl border border-border bg-card/40 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Language</span>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={locked}
            title={locked ? "Stop playback to change the language" : undefined}
            className="bg-transparent text-sm font-medium text-foreground focus:outline-none disabled:opacity-60 cursor-pointer"
          >
            {STUDIO_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} · {l.native}
              </option>
            ))}
          </select>
        </label>

        <Link
          href="/settings?tab=voice"
          className="group flex items-center gap-3 rounded-xl border border-border bg-card/40 px-3 py-2 hover:bg-muted/60 transition-colors min-w-[220px]"
          title="Change the voice in Settings → Voice"
        >
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Robot voice</span>
            {voiceLoading ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Checking…
              </span>
            ) : voiceError || !voice ? (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{voiceError ?? "Unavailable"}</span>
              </span>
            ) : (
              <>
                <span className="block text-sm font-medium text-foreground truncate">
                  {PROVIDER_LABELS[voice.provider] ?? voice.provider} · <span className="capitalize">{voice.voice}</span>
                </span>
                <span className="block font-mono text-[10px] text-muted-foreground tabular-nums">{voiceDetail(voice)}</span>
              </>
            )}
          </div>
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
        </Link>
      </div>
    </div>
  );
}
