"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiLink, FiSave } from "react-icons/fi";

export function WebhookModule() {
  return (
    <FeatureGate featureKey="webhook">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6">
          <h3 className="text-xl font-bold uppercase tracking-wide">Webhook Integrations</h3>
          <p className="text-sm text-muted-foreground font-mono mt-1">Configure external API endpoints to receive real-time robot events.</p>
        </div>

        <div className="p-6 border border-border bg-card/30 rounded-xl space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">Endpoint URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FiLink className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="url" 
                  placeholder="https://api.yourdomain.com/webhook"
                  className="w-full bg-background border border-border pl-12 pr-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors rounded-lg"
                />
              </div>
              <button className="flex items-center justify-center gap-2 px-6 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity rounded-lg">
                <FiSave /> Save
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">Event Subscriptions</label>
            <div className="grid grid-cols-2 gap-3">
              {['Conversation Started', 'Intent Detected', 'Error Occurred', 'Battery Low', 'Wake Word Detected', 'Health Alert'].map(event => (
                <label key={event} className="flex items-center gap-3 p-3 border border-border bg-background rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <input type="checkbox" className="accent-primary w-4 h-4" defaultChecked={['Conversation Started', 'Intent Detected'].includes(event)} />
                  <span className="text-sm font-semibold">{event}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
