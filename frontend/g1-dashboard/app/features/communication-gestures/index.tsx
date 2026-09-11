"use client";

import React, { useState, useCallback } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import {
  FiPlay, FiLoader, FiCheckCircle, FiAlertCircle,
  FiCpu, FiList
} from "react-icons/fi";
import { api, API_BASE_URL } from "@/lib/api";
import { useGestures } from "@/app/features/configuration-gestures/useGestures";

// ── Builtin gesture catalogue ────────────────────────────────────────────────
// Names must exactly match the keys in robot_agent.cpp's gesture dispatcher
// and BUILTIN_GESTURES in robot_sync.py / backend gestures.py.
const BUILTIN_GESTURES = [
  { id: "wave_hello",     label: "Wave Hello",      emoji: "👋",  desc: "Friendly inward wave" },
  { id: "wave_goodbye",   label: "Wave Goodbye",    emoji: "✋",  desc: "Turn & wave, then return" },
  { id: "shake_hand",     label: "Shake Hand",      emoji: "🤝",  desc: "Extend arm + retract" },
  { id: "high_five",      label: "High Five",       emoji: "🖐️", desc: "Raise palm for a high-five" },
  { id: "hug",            label: "Hug",             emoji: "🫂",  desc: "Open-arms welcoming gesture" },
  { id: "high_wave",      label: "High Wave",       emoji: "🙋",  desc: "Arm raised overhead wave" },
  { id: "clap",           label: "Clap",            emoji: "👏",  desc: "Clapping motion" },
  { id: "left_kiss",      label: "Left Kiss",       emoji: "💋",  desc: "Kissy gesture to the left" },
  { id: "right_kiss",     label: "Right Kiss",      emoji: "💋",  desc: "Kissy gesture to the right" },
  { id: "two_hand_kiss",  label: "Two-Hand Kiss",   emoji: "🤲",  desc: "Blow a kiss with both hands" },
  { id: "heart",          label: "Heart",           emoji: "❤️",  desc: "Heart shape with both arms" },
  { id: "hands_up",       label: "Hands Up",        emoji: "🙌",  desc: "Both arms raised high" },
  { id: "x_ray",          label: "X-Ray Pose",      emoji: "🦸",  desc: "Superhero spread pose" },
  { id: "reject",         label: "Reject",          emoji: "🙅",  desc: "Cross-arm rejection wave" },
] as const;

type GestureId = typeof BUILTIN_GESTURES[number]["id"];
type PlayState = "idle" | "playing" | "success" | "error";

// ── Small hook for playing builtin gestures ──────────────────────────────────
function useBuiltinGestures() {
  const [playStates, setPlayStates] = useState<Record<string, PlayState>>({});

  const playBuiltin = useCallback(async (gestureId: GestureId) => {
    setPlayStates(s => ({ ...s, [gestureId]: "playing" }));
    try {
      const token = api.getToken();
      const res = await fetch(
        `${API_BASE_URL}/gestures/builtin/${encodeURIComponent(gestureId)}/play`,
        { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setPlayStates(s => ({ ...s, [gestureId]: res.ok ? "success" : "error" }));
    } catch {
      setPlayStates(s => ({ ...s, [gestureId]: "error" }));
    } finally {
      // Reset back to idle after 2 s so the button is usable again
      setTimeout(() => setPlayStates(s => ({ ...s, [gestureId]: "idle" })), 2000);
    }
  }, []);

  return { playStates, playBuiltin };
}

// ── Builtin gesture card ─────────────────────────────────────────────────────
function BuiltinCard({
  gesture,
  canPlay,
  state,
  onPlay,
}: {
  gesture: typeof BUILTIN_GESTURES[number];
  canPlay: boolean;
  state: PlayState;
  onPlay: () => void;
}) {
  const isPlaying = state === "playing";
  const isSuccess = state === "success";
  const isError   = state === "error";

  return (
    <div
      className={`relative p-5 rounded-2xl border transition-all duration-300 group
        ${isPlaying ? "border-primary/60 bg-primary/5 shadow-[0_0_20px_rgba(99,102,241,0.12)]"
          : isSuccess ? "border-green-500/40 bg-green-500/5"
          : isError   ? "border-red-500/40 bg-red-500/5"
          : "border-border bg-card/30 hover:bg-card/60 hover:border-border/80"}`}
    >
      {/* Emoji badge */}
      <div className="text-3xl mb-3 leading-none">{gesture.emoji}</div>

      <h4 className="font-bold text-sm text-foreground mb-1">{gesture.label}</h4>
      <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">{gesture.desc}</p>

      <button
        onClick={onPlay}
        disabled={!canPlay || isPlaying}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-200
          ${isPlaying  ? "bg-primary/20 text-primary cursor-wait"
          : isSuccess  ? "bg-green-500/20 text-green-400"
          : isError    ? "bg-red-500/20 text-red-400"
          : canPlay    ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
          : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"}`}
      >
        {isPlaying  ? <><FiLoader className="animate-spin" /> Playing…</>
        : isSuccess  ? <><FiCheckCircle /> Done</>
        : isError    ? <><FiAlertCircle /> Error</>
        : <><FiPlay /> Play</>}
      </button>
    </div>
  );
}

// ── Recorded gesture card ────────────────────────────────────────────────────
function RecordedCard({
  gesture,
  canPlay,
  onPlay,
}: {
  gesture: { id: string; name: string; duration_s: number; sample_count: number; created_at: string };
  canPlay: boolean;
  onPlay: () => void;
}) {
  return (
    <div className="p-5 rounded-2xl border border-border bg-card/30 hover:bg-card/60 transition-all group">
      <div className="text-3xl mb-3 leading-none">🎭</div>
      <h4 className="font-bold text-sm text-foreground font-mono mb-1 truncate">{gesture.name}</h4>
      <p className="text-[11px] text-muted-foreground mb-4">
        {gesture.duration_s.toFixed(1)}s · {gesture.sample_count} frames
      </p>
      <button
        onClick={onPlay}
        disabled={!canPlay}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all
          ${canPlay
            ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"}`}
      >
        <FiPlay /> Play
      </button>
    </div>
  );
}

// ── Main module ──────────────────────────────────────────────────────────────
export function CommunicationGesturesModule() {
  const [tab, setTab] = useState<"builtin" | "recorded">("builtin");

  // Reuse the same robot-health hook used by ConfigurationGesturesModule
  const { isHealthy, robotStatus, gestures, loading, playGesture } = useGestures();
  const { playStates, playBuiltin } = useBuiltinGestures();

  const canControl = isHealthy === true && robotStatus === "online";

  return (
    <FeatureGate featureKey="communicationGestures">
      <div className="space-y-8 pt-8 border-t border-border">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-primary font-mono text-sm bg-primary/10 px-2 py-1 rounded">[COM]</span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Gesture Library</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Trigger pre-built arm actions or your recorded macros — one gesture at a time.
            </p>
          </div>

          {/* Robot status pill */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border shrink-0 ${
            robotStatus === "online"  ? "bg-green-500/10 border-green-500/20 text-green-400"
            : robotStatus === "unknown" ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <span className="relative flex h-3 w-3">
              {robotStatus === "online" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                robotStatus === "online"  ? "bg-green-500"
                : robotStatus === "unknown" ? "bg-amber-500"
                : "bg-red-500"
              }`} />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest">
              {robotStatus === "online" ? "Robot Connected" : robotStatus === "unknown" ? "Unknown" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit border border-border">
          {([["builtin", "Built-in", FiCpu], ["recorded", "Recorded", FiList]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === key
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} /> {label}
              {key === "recorded" && gestures.length > 0 && (
                <span className="ml-1 text-[10px] font-mono bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {gestures.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Builtin tab */}
        {tab === "builtin" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {BUILTIN_GESTURES.map((g) => (
              <BuiltinCard
                key={g.id}
                gesture={g}
                canPlay={canControl}
                state={playStates[g.id] ?? "idle"}
                onPlay={() => playBuiltin(g.id)}
              />
            ))}
          </div>
        )}

        {/* Recorded tab */}
        {tab === "recorded" && (
          <>
            {loading && gestures.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                Loading recorded gestures…
              </div>
            ) : gestures.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-2xl text-muted-foreground text-sm">
                No recorded gestures yet.{" "}
                <span className="text-primary">Go to Custom Gestures above to record one.</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {gestures.map((g) => (
                  <RecordedCard
                    key={g.id}
                    gesture={g}
                    canPlay={canControl}
                    onPlay={() => playGesture(g.name)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Offline notice */}
        {!canControl && (
          <p className="text-xs text-muted-foreground text-center">
            {isHealthy === false
              ? "⚠ Cannot reach robot_sync on the Thor — is the AGX powered on?"
              : "⚠ Robot is offline — power on the G1 and connect it to the Thor before playing gestures."}
          </p>
        )}
      </div>
    </FeatureGate>
  );
}
