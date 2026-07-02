"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiMessageSquare } from "react-icons/fi";

export function CommunicationGesturesModule() {
  return (
    <FeatureGate featureKey="communicationGestures">
      <div className="space-y-8 pt-8 border-t border-border">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-primary font-mono text-sm">[COM]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Communication Gestures</h2>
        </div>
        
        <div className="p-8 border border-border bg-card/20 rounded-xl flex flex-col items-center justify-center text-center gap-4">
          <div className="p-4 bg-primary/10 rounded-full text-primary">
            <FiMessageSquare size={32} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Dynamic Expressiveness</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
              Enable this feature to allow the robot to automatically generate context-aware hand and head gestures while speaking long explanations.
            </p>
          </div>
          
          <div className="mt-4 flex items-center gap-4 border border-border px-6 py-3 bg-background rounded-full shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">Auto-Gesture Engine Active</span>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
