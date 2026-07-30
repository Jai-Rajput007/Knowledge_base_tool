"use client";

import React from "react";
import dynamic from "next/dynamic";
import { PersonaProvider } from "@/app/features/persona/context";
import { PersonaHeader } from "@/app/features/persona/header";
import { LazySection } from "@/components/ui/lazy-section";

const PersonaChangeModule = dynamic(() => import("@/app/features/persona-change").then(m => m.PersonaChangeModule), { ssr: false });
const GenerativePersonaModule = dynamic(() => import("@/app/features/generative-persona").then(m => m.GenerativePersonaModule), { ssr: false });
const PrebuiltPersonasModule = dynamic(() => import("@/app/features/prebuilt-personas").then(m => m.PrebuiltPersonasModule), { ssr: false });
const PersonaLibraryModule = dynamic(() => import("@/app/features/persona-library").then(m => m.PersonaLibraryModule), { ssr: false });
const EmotionsModule = dynamic(() => import("@/app/features/emotions").then(m => m.EmotionsModule), { ssr: false });

export default function PersonaManagerPage() {
  return (
    <PersonaProvider>
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        <PersonaHeader />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <LazySection><PersonaChangeModule /></LazySection>
          <LazySection><GenerativePersonaModule /></LazySection>
          <LazySection><PrebuiltPersonasModule /></LazySection>
        </div>

        <LazySection><PersonaLibraryModule /></LazySection>
        <LazySection><EmotionsModule /></LazySection>
      </div>
    </PersonaProvider>
  );
}