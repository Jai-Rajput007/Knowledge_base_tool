"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiDownloadCloud, FiCheckCircle } from "react-icons/fi";

export function OtaUpdatesModule() {
  return (
    <FeatureGate featureKey="otaUpdates">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6">
          <h3 className="text-xl font-bold uppercase tracking-wide">Over-the-Air (OTA) Updates</h3>
          <p className="text-sm text-muted-foreground font-mono mt-1">Manage robot firmware and software patches.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 p-6 border border-border bg-card/30 rounded-xl relative overflow-hidden">
            <div className="absolute -right-10 -top-10 text-primary/5">
              <FiCheckCircle size={150} />
            </div>
            <div className="relative z-10">
              <div className="text-[10px] uppercase font-mono tracking-widest text-primary mb-2">Current Version</div>
              <h4 className="text-3xl font-bold tracking-tighter">v2.4.1-stable</h4>
              <p className="text-sm text-muted-foreground mt-2">Your robot is up to date.</p>
              <div className="mt-6 text-xs font-mono text-muted-foreground">
                Last checked: Today, 08:00 AM
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 border border-border bg-card/30 rounded-xl flex flex-col justify-center items-center text-center">
            <div className="p-4 bg-secondary/50 text-secondary-foreground rounded-full mb-4">
              <FiDownloadCloud size={24} />
            </div>
            <h4 className="font-bold text-lg mb-2">Check for Updates</h4>
            <p className="text-xs text-muted-foreground mb-6">Connect to the update server to see if a newer version is available.</p>
            <button className="px-6 py-2 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider rounded shadow hover:opacity-90">
              Check Now
            </button>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
