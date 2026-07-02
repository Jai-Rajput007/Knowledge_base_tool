"use client";

import React, { useState } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiVolume2, FiActivity, FiFastForward, FiSliders, FiPlay, FiSave, FiRefreshCw } from "react-icons/fi";

export function VoiceSettingsModule() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    pitch: 50,
    volume: 80,
    speed: 50,
    sampleRate: 24000,
  });

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 800);
  };

  const Slider = ({ label, icon: Icon, value, min, max, onChange, unit = "%" }: any) => (
    <div className="space-y-4 p-6 border border-border bg-card/30 rounded-xl hover:bg-card/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Icon size={18} />
          </div>
          <span className="font-mono text-sm uppercase tracking-wider">{label}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border border-border">
          {value}{unit}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );

  return (
    <FeatureGate featureKey="voiceSettings">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Slider 
            label="Pitch" 
            icon={FiActivity} 
            value={settings.pitch} 
            min={0} max={100} 
            onChange={(v: number) => setSettings({...settings, pitch: v})} 
          />
          <Slider 
            label="Volume" 
            icon={FiVolume2} 
            value={settings.volume} 
            min={0} max={100} 
            onChange={(v: number) => setSettings({...settings, volume: v})} 
          />
          <Slider 
            label="Speech Speed" 
            icon={FiFastForward} 
            value={settings.speed} 
            min={0} max={100} 
            onChange={(v: number) => setSettings({...settings, speed: v})} 
          />
          
          <div className="space-y-4 p-6 border border-border bg-card/30 rounded-xl hover:bg-card/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <FiSliders size={18} />
                </div>
                <span className="font-mono text-sm uppercase tracking-wider">Sample Rate</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border border-border">
                {settings.sampleRate} Hz
              </span>
            </div>
            <select 
              value={settings.sampleRate}
              onChange={(e) => setSettings({...settings, sampleRate: Number(e.target.value)})}
              className="w-full bg-background border border-border p-3 rounded-lg font-mono text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
            >
              <option value={16000}>16,000 Hz (Standard)</option>
              <option value={24000}>24,000 Hz (High Quality)</option>
              <option value={44100}>44,100 Hz (Studio)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border border-border bg-card/20 rounded-xl">
          <button className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity rounded-lg">
            <FiPlay /> Test Voice
          </button>
          
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg hover:-translate-y-0.5 rounded-lg"
          >
            {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
            {saving ? "Saving..." : "Apply Settings"}
          </button>
        </div>
      </div>
    </FeatureGate>
  );
}
