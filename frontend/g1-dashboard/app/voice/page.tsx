"use client";

import { VoiceSettingsModule } from "@/app/features/voice-settings";

export default function VoiceSettingsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Voice Settings
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Configure acoustic parameters and speech synthesis
        </p>
      </div>

      <VoiceSettingsModule />
    </div>
  );
}