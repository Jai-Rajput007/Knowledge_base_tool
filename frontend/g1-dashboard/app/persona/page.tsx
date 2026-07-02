"use client";

import React from "react";
import { PersonaProvider } from "@/app/features/persona/context";
import { PersonaHeader } from "@/app/features/persona/header";
import { PersonaChangeModule } from "@/app/features/persona-change";
import { GenerativePersonaModule } from "@/app/features/generative-persona";
import { PrebuiltPersonasModule } from "@/app/features/prebuilt-personas";
import { PersonaLibraryModule } from "@/app/features/persona-library";
import { EmotionsModule } from "@/app/features/emotions";

export default function PersonaManagerPage() {
  return (
    <PersonaProvider>
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        <PersonaHeader />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <PersonaChangeModule />
          <GenerativePersonaModule />
          <PrebuiltPersonasModule />
        </div>

        <PersonaLibraryModule />
        <EmotionsModule />
      </div>
    </PersonaProvider>
  );
}