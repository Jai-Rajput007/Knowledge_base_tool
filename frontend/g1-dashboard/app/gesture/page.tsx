"use client";

import { ConfigurationGesturesModule } from "@/app/features/configuration-gestures";
import { CommunicationGesturesModule } from "@/app/features/communication-gestures";

export default function GestureSettingsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
          Gesture Settings
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
          SYS.CONFIG // Configure physical expression and movement macros
        </p>
      </div>

      <ConfigurationGesturesModule />
      <CommunicationGesturesModule />
    </div>
  );
}