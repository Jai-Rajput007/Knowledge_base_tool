"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiEye, FiLoader, FiAlertCircle } from "react-icons/fi";
import { useVisionConfig } from "./hooks";

/**
 * VLM Vision settings tab (feature flag `vlmVision`). Lets an admin/editor turn the
 * robot's onboard vision-language-model tool on or off — the model that answers
 * "how am I looking?" / "what do you see?" by looking through the robot's own camera
 * (g1-nlp/services/perception/vision_service.py + FRS's /snapshot endpoint).
 *
 * The VLM (Ollama, currently qwen2.5vl:7b) stays loaded on the robot at all times once
 * warmed up at pipeline start — this toggle only controls whether the conversation LLM
 * is offered the tool at all, not whether the model is resident in GPU memory. Model
 * choice, timeouts, and snapshot cropping are perf/quality knobs that need a matched
 * `ollama pull` + a fresh latency check on the Thor before changing (see
 * g1-nlp/tests/test_vision_latency.py) — deliberately not exposed here yet.
 */
export function VlmVisionModule() {
  const { config, loading, toggling, error, clearError, setEnabled } = useVisionConfig();

  return (
    <FeatureGate featureKey="vlmVision">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card/30">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-primary"><FiEye size={20} /></span>
            <div>
              <p className="font-medium text-card-foreground">Vision tool</p>
              <p className="text-sm text-muted-foreground max-w-md">
                Lets the robot answer questions about what it sees or how someone looks by
                calling its onboard vision-language model. Off by default — the robot has no
                camera awareness at all until this is enabled.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={!!config?.enabled}
            disabled={loading || toggling || !config}
            onClick={() => config && setEnabled(!config.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
              config?.enabled ? "bg-primary" : "bg-accent"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                config?.enabled ? "right-0.5" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FiLoader className="animate-spin" /> Loading current status from the robot…
          </p>
        )}

        {config && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-border bg-card/20">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Model</p>
              <p className="font-mono text-card-foreground">{config.model}</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card/20">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Timeout</p>
              <p className="font-mono text-card-foreground">{config.timeout_s}s</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <span className="flex items-center gap-2"><FiAlertCircle /> {error}</span>
            <button onClick={clearError} className="font-bold">✕</button>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}
