"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiRotateCcw, FiClock } from "react-icons/fi";

export function RollbackModule() {
  const snapshots = [
    { id: "v4", date: "Today, 10:45 AM", trigger: "Manual Save", status: "current" },
    { id: "v3", date: "Yesterday, 02:30 PM", trigger: "Auto Save", status: "stable" },
    { id: "v2", date: "Mon, 09:00 AM", trigger: "Pre-deployment", status: "stable" },
  ];

  return (
    <FeatureGate featureKey="rollback">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold uppercase tracking-wide">System Rollback</h3>
            <p className="text-sm text-muted-foreground font-mono mt-1">Restore robot configuration from previous snapshots.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-border text-foreground font-mono text-xs uppercase tracking-wider rounded shadow hover:bg-card/50">
            Create Snapshot
          </button>
        </div>

        <div className="relative border-l-2 border-border ml-4 space-y-8 py-4">
          {snapshots.map((snap, i) => (
            <div key={snap.id} className="relative pl-8 group">
              <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background ${snap.status === 'current' ? 'bg-primary shadow-[0_0_10px_rgba(0,118,255,0.5)]' : 'bg-muted-foreground'}`} />
              <div className="p-4 border border-border rounded-xl bg-card/30 group-hover:bg-card/60 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      Snapshot {snap.id}
                      {snap.status === 'current' && <span className="text-[9px] uppercase font-mono bg-primary/20 text-primary px-2 py-0.5 rounded">Active</span>}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                      <FiClock size={12} /> {snap.date} • {snap.trigger}
                    </div>
                  </div>
                  {snap.status !== 'current' && (
                    <button className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-500 hover:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded transition-colors">
                      <FiRotateCcw size={14} /> Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeatureGate>
  );
}
