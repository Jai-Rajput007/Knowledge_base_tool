"use client";

import React, { useState, useCallback } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import {
  FiPlay, FiLoader, FiCheckCircle, FiAlertCircle,
  FiCpu, FiList, FiMessageSquare, FiSave, FiPlus, FiX, FiShield
} from "react-icons/fi";
import { api, API_BASE_URL } from "@/lib/api";
import { useGestures } from "@/app/features/configuration-gestures/useGestures";
import { useCommunicationSet } from "./hooks";
import { DURATION_BANDS, durationBand, UNITREE_ROLES, type DurationBand } from "./types";

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
  inCommSet,
  occupiedBy,
  onAddToSet,
  onRemoveFromSet,
}: {
  gesture: { id: string; name: string; duration_s: number; sample_count: number; created_at: string };
  canPlay: boolean;
  onPlay: () => void;
  /** Is THIS gesture currently the one occupying its band in the communication set? */
  inCommSet: boolean;
  /** If a DIFFERENT gesture currently occupies this one's band, its name — used to warn on replace. */
  occupiedBy: string | null;
  onAddToSet: () => void;
  onRemoveFromSet: () => void;
}) {
  const band = durationBand(gesture.duration_s);
  return (
    <div className={`p-5 rounded-2xl border transition-all group ${
      inCommSet ? "border-primary bg-primary/5" : "border-border bg-card/30 hover:bg-card/60"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-3xl leading-none">🎭</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {band}
        </span>
      </div>
      <h4 className="font-bold text-sm text-foreground font-mono mb-1 truncate">{gesture.name}</h4>
      <p className="text-[11px] text-muted-foreground mb-4">
        {gesture.duration_s.toFixed(1)}s · {gesture.sample_count} frames
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPlay}
          disabled={!canPlay}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all
            ${canPlay
              ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"}`}
        >
          <FiPlay /> Play
        </button>
        <button
          onClick={inCommSet ? onRemoveFromSet : onAddToSet}
          title={
            inCommSet
              ? "Remove from Use While Explaining"
              : occupiedBy
              ? `Replaces '${occupiedBy}' as the ${band} gesture`
              : `Use as the ${band} gesture while explaining`
          }
          className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${
            inCommSet
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-foreground/5 text-foreground hover:bg-foreground/10"
          }`}
        >
          {inCommSet ? <FiCheckCircle /> : <FiPlus />}
        </button>
      </div>
    </div>
  );
}

// ── "Use while explaining" panel ─────────────────────────────────────────────
// Shows the current Short/Medium/Long slots and lets the robot chain through whichever
// ones are filled while giving a spoken explanation — see
// g1-nlp/services/gesture/comm_gesture.py. Two mutually exclusive modes, picked per robot
// depending on whether it has a physical waist lock fitted:
//   "recorded"     — our own recordings (add from the Recorded tab below). Needs a waist
//                    lock: recording without one was found to destabilize the robot.
//   "unitree_app"  — 3 gestures taught through the Unitree mobile app's "demo teaching"
//                    feature, typed in here by name and confirmed with Verify before they
//                    can be enabled (there's no way to list them — Verify actually fires
//                    each one briefly to check the robot accepts it).
function CommunicationSetPanel({
  set,
  canControl,
}: {
  set: ReturnType<typeof useCommunicationSet>;
  canControl: boolean;
}) {
  const {
    mode, switchMode, selected, bandOf, removeFromSet,
    unitreeRoles, setUnitreeRole, verifying, verifyResult, rolesVerified, verifyRoles,
    enabled, setEnabled, canEnable, dirty,
    loading, saving, testing, testingRole, testRole, error, clearError, save, test,
  } = set;
  const [savedMsg, setSavedMsg] = useState(false);

  const onSave = async () => {
    const ok = await save();
    if (ok) {
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    }
  };

  const slotted: Record<DurationBand, string | null> = { Short: null, Medium: null, Long: null };
  for (const name of selected) {
    const band = bandOf(name);
    if (band) slotted[band] = name;
  }

  const hasAnyRole = UNITREE_ROLES.some((r) => unitreeRoles[r]?.trim());
  const canTest = mode === "recorded" ? selected.length > 0 : hasAnyRole;

  return (
    <div className="p-6 rounded-2xl border border-border bg-card/30 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-primary font-mono text-sm bg-primary/10 px-2 py-1 rounded">[EXPLAIN]</span>
          <div>
            <h3 className="font-bold text-sm text-foreground uppercase tracking-wide">Use While Explaining</h3>
            <p className="text-xs text-muted-foreground">
              The robot picks whichever gesture fits how much is left to say, and returns
              its hands to rest when it stops talking.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={!canEnable && !enabled}
            title={!canEnable && !enabled ? "Nothing set up to enable yet" : undefined}
            onClick={() => setEnabled(!enabled)}
            className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted"} ${
              !canEnable && !enabled ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-transform ${
                enabled ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit border border-border">
        {(
          [
            ["recorded", "Our UI (needs waist lock)"],
            ["unitree_app", "Unitree App (no waist lock)"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => switchMode(key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              mode === key
                ? "bg-background text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>
      ) : mode === "recorded" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DURATION_BANDS.map((band) => {
            const name = slotted[band];
            return (
              <div
                key={band}
                className={`p-4 rounded-xl border ${
                  name ? "border-primary bg-primary/5" : "border-dashed border-border bg-muted/10"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{band}</span>
                {name ? (
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-sm font-mono font-semibold text-foreground truncate">{name}</p>
                    <button
                      onClick={() => removeFromSet(name)}
                      title="Remove from Use While Explaining (keeps the recording)"
                      className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Not set — add one from the Recorded tab below</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Teach 3 gestures through the Unitree mobile app&apos;s <em>demo teaching</em> feature (e.g.
            named <code className="font-mono">small-demo</code>, <code className="font-mono">medium-demo</code>,{" "}
            <code className="font-mono">long-demo</code>), type the exact names below, then click Verify —
            there&apos;s no way to list taught gestures, so Verify briefly fires each one to confirm the
            robot accepts it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {UNITREE_ROLES.map((role) => {
              const status = verifyResult?.[role];
              const value = unitreeRoles[role];
              const isTestingThis = testingRole === role;
              return (
                <div key={role} className="p-4 rounded-xl border border-border bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{role}</span>
                    <button
                      onClick={() => testRole(role)}
                      disabled={!value.trim() || isTestingThis || !canControl}
                      title={`Play just the ${role} gesture on the robot`}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                        value.trim() && !isTestingThis && canControl
                          ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                          : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"
                      }`}
                    >
                      {isTestingThis ? <FiLoader className="animate-spin" size={11} /> : <FiPlay size={11} />}
                      Test
                    </button>
                  </div>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setUnitreeRole(role, e.target.value)}
                    placeholder={`${role}-demo`}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {value.trim() && status && (
                    <div
                      className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                        status.found ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {status.found ? <FiCheckCircle size={12} /> : <FiAlertCircle size={12} />}
                      {status.found ? "Found on robot" : `Not found (ret=${status.ret})`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={verifyRoles}
              disabled={!hasAnyRole || verifying || !canControl}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                hasAnyRole && !verifying && canControl
                  ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                  : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              {verifying ? <><FiLoader className="animate-spin" /> Verifying…</> : <><FiShield /> Verify</>}
            </button>
            {rolesVerified && (
              <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                <FiCheckCircle /> All set gestures confirmed on robot
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <span>{error}</span>
          <button onClick={clearError} className="font-bold">✕</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
            dirty && !saving
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"
          }`}
        >
          {saving ? <><FiLoader className="animate-spin" /> Saving…</> : <><FiSave /> Save</>}
        </button>

        <button
          onClick={test}
          disabled={!canTest || testing || !canControl}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
            canTest && !testing && canControl
              ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
              : "bg-muted/20 text-muted-foreground cursor-not-allowed opacity-50"
          }`}
        >
          {testing ? <><FiLoader className="animate-spin" /> Testing…</> : <><FiMessageSquare /> Test Sequence</>}
        </button>

        {savedMsg && <span className="text-xs text-green-400 font-semibold">Saved</span>}
      </div>
    </div>
  );
}

// ── Main module ──────────────────────────────────────────────────────────────
export function CommunicationGesturesModule() {
  const [tab, setTab] = useState<"builtin" | "recorded">("builtin");

  // Reuse the same robot-health hook used by ConfigurationGesturesModule
  const { isHealthy, robotStatus, gestures, loading, playGesture } = useGestures();
  const { playStates, playBuiltin } = useBuiltinGestures();
  const commSet = useCommunicationSet(gestures);

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
                {gestures.map((g) => {
                  const band = durationBand(g.duration_s);
                  const occupant = commSet.selected.find((n) => n !== g.name && commSet.bandOf(n) === band);
                  return (
                    <RecordedCard
                      key={g.id}
                      gesture={g}
                      canPlay={canControl}
                      onPlay={() => playGesture(g.name)}
                      inCommSet={commSet.selected.includes(g.name)}
                      occupiedBy={occupant ?? null}
                      onAddToSet={() => commSet.addToSet(g.name)}
                      onRemoveFromSet={() => commSet.removeFromSet(g.name)}
                    />
                  );
                })}
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

        {/* Communication-gesture set — which recordings the robot uses while explaining */}
        <CommunicationSetPanel set={commSet} canControl={canControl} />
      </div>
    </FeatureGate>
  );
}
