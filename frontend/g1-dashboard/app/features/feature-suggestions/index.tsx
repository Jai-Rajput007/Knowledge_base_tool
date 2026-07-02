"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiZap } from "react-icons/fi";

export function FeatureSuggestionsModule() {
  return (
    <FeatureGate featureKey="featureSuggestions" hideWhenDisabled={true}>
      <div className="p-6 border border-border bg-card/20 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
            <FiZap size={18} />
          </div>
          <h3 className="font-bold text-sm uppercase tracking-wide">AI Recommendations</h3>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Based on your recent usage, consider enabling:</p>
          <div className="p-3 border border-border bg-background rounded-lg flex items-center justify-between">
            <span className="text-sm font-semibold">Generative Persona</span>
            <button className="text-xs font-mono uppercase tracking-widest text-primary hover:underline">Enable</button>
          </div>
          <div className="p-3 border border-border bg-background rounded-lg flex items-center justify-between">
            <span className="text-sm font-semibold">Over-the-Air Updates</span>
            <button className="text-xs font-mono uppercase tracking-widest text-primary hover:underline">Enable</button>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
