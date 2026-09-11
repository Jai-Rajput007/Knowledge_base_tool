"use client";

/**
 * Voice Studio — make the robot speak arbitrary text (feature flag `voiceStudio`).
 *
 *   Composer       free text or an uploaded .txt script -> Speak
 *   Playlist       turn-by-turn script: reorder, play all in order, or play one turn
 *   TransportBar   what the robot is saying now + pause / resume / stop
 *
 * Audio plays on the ROBOT speaker (not in the browser) using the voice saved in
 * Settings -> Voice for the selected language. The language is chosen explicitly here,
 * never auto-detected. Playback state lives on the robot (g1-nlp services/voice_studio).
 */

import { useMemo, useState } from "react";
import { CircleAlert, X } from "lucide-react";
import { FeatureGate } from "@/app/components/feature-gate";
import { COMPOSER_ITEM_ID, MAX_TOTAL_CHARS } from "./constants";
import { useStudioPlayer } from "./hooks/useStudioPlayer";
import { usePlaylist } from "./hooks/usePlaylist";
import { useStudioLanguage, useStudioVoice } from "./hooks/useStudioVoice";
import { StudioHeader } from "./components/StudioHeader";
import { TransportBar } from "./components/TransportBar";
import { Composer } from "./components/Composer";
import { Playlist } from "./components/Playlist";
import type { NowPlaying, PlaylistEntry } from "./types";

const snippet = (text: string) => (text.length > 140 ? `${text.slice(0, 140)}…` : text);

export function VoiceStudioModule() {
  const player = useStudioPlayer();
  const playlist = usePlaylist();
  const [language, setLanguage] = useStudioLanguage();
  const voice = useStudioVoice(language);
  const [composerSent, setComposerSent] = useState<{ text: string; source: string } | null>(null);
  // Validation errors (bad file, too long) are local; robot errors (TTS down, speaker
  // unreachable) come from the player. Both share one dismissible banner.
  const [localError, setLocalError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const robotError = player.error && player.error !== dismissedError ? player.error : null;
  const banner = localError ?? robotError;

  const { status } = player;
  const live = status?.state === "playing" || status?.state === "preparing" || status?.state === "paused";

  const nowPlaying: NowPlaying | null = useMemo(() => {
    const id = status?.current_item_id;
    if (!id) return null;
    if (id === COMPOSER_ITEM_ID && composerSent) {
      return { label: composerSent.source, snippet: snippet(composerSent.text) };
    }
    const i = playlist.entries.findIndex((e) => e.id === id);
    if (i < 0) return { label: "Playing", snippet: "" };
    const e = playlist.entries[i];
    return { label: e.title.trim() || `Turn ${i + 1}`, snippet: snippet(e.text) };
  }, [status?.current_item_id, playlist.entries, composerSent]);

  const speakComposer = (text: string, source: string) => {
    setComposerSent({ text, source });
    setLocalError(null);
    player.play([{ id: COMPOSER_ITEM_ID, text }], language);
  };

  const playEntries = (list: PlaylistEntry[]) => {
    const items = list.filter((e) => e.text.trim()).map((e) => ({ id: e.id, text: e.text }));
    const total = items.reduce((n, i) => n + i.text.length, 0);
    if (total > MAX_TOTAL_CHARS) {
      showError(`The playlist has ${total.toLocaleString()} characters — the robot accepts up to ${MAX_TOTAL_CHARS.toLocaleString()} per play. Split it or play turns one at a time.`);
      return;
    }
    setLocalError(null);
    player.play(items, language);
  };

  const showError = (message: string) => setLocalError(message);

  return (
    <FeatureGate featureKey="voiceStudio">
      <div className="max-w-6xl mx-auto space-y-8 pb-32 pt-8">
        <StudioHeader
          language={language}
          onLanguageChange={setLanguage}
          voice={voice.data}
          voiceError={voice.error ? (voice.error as Error).message : null}
          voiceLoading={voice.isLoading}
          locked={live}
        />

        <div className="sticky top-4 z-30">
          <TransportBar
            status={status}
            nowPlaying={nowPlaying}
            busy={player.busy}
            reachable={player.reachable}
            onPause={player.pause}
            onResume={player.resume}
            onStop={player.stop}
          />
        </div>

        {banner && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <CircleAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive flex-1">{banner}</p>
            <button
              type="button"
              onClick={() => { setLocalError(null); setDismissedError(player.error); player.clearError(); }}
              aria-label="Dismiss"
              className="p-0.5 rounded text-destructive/80 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
          <Composer
            busy={player.busy}
            onSpeak={speakComposer}
            onAddToPlaylist={(text) => playlist.add(text)}
            onError={showError}
          />
          <Playlist
            entries={playlist.entries}
            status={status}
            busy={player.busy}
            full={playlist.full}
            onReorder={playlist.setEntries}
            onAdd={() => playlist.add()}
            onClear={playlist.clear}
            onUpdate={playlist.update}
            onRemove={playlist.remove}
            onMove={playlist.move}
            onPlayAll={() => playEntries(playlist.entries)}
            onPlayOne={(entry) => playEntries([entry])}
            onPause={player.pause}
            onResume={player.resume}
          />
        </div>

        <p className="text-xs text-muted-foreground max-w-2xl">
          Audio plays on the robot&apos;s speaker, not in this browser. If someone is talking to the
          robot at the same time, both voices can overlap — stop the Studio before a live conversation.
        </p>
      </div>
    </FeatureGate>
  );
}
