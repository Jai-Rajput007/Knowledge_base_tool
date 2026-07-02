"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";

export function EmotionsModule() {
  return (
    <FeatureGate featureKey="emotions" hideWhenDisabled={true}>
      <section className="pt-8 border-t border-border">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[EMO]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Emotional Responses</h2>
        </div>
        <div className="border border-border bg-card/20 p-8 rounded-xl flex items-center justify-center">
          <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest">[ Module under development ]</span>
        </div>
      </section>
    </FeatureGate>
  );
}
