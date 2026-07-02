"use client";

import React, { useState } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiGlobe, FiCheck } from "react-icons/fi";

export function MultilingualModule() {
  const [activeLang, setActiveLang] = useState("en");

  const languages = [
    { code: "en", name: "English (US)", status: "installed" },
    { code: "es", name: "Spanish (ES)", status: "installed" },
    { code: "fr", name: "French (FR)", status: "downloading" },
    { code: "de", name: "German (DE)", status: "available" },
    { code: "ja", name: "Japanese (JP)", status: "available" },
  ];

  return (
    <FeatureGate featureKey="multilingual">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6">
          <h3 className="text-xl font-bold uppercase tracking-wide">Language & Localization</h3>
          <p className="text-sm text-muted-foreground font-mono mt-1">Configure primary language and download voice packs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {languages.map(lang => (
            <div 
              key={lang.code}
              onClick={() => lang.status === "installed" && setActiveLang(lang.code)}
              className={`p-4 border rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                activeLang === lang.code ? 'border-primary bg-primary/10' : 'border-border bg-card/30 hover:bg-card/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <FiGlobe className={activeLang === lang.code ? 'text-primary' : 'text-muted-foreground'} />
                <span className="font-semibold text-sm">{lang.name}</span>
              </div>
              
              {lang.status === "installed" && activeLang === lang.code && <FiCheck className="text-primary" />}
              {lang.status === "installed" && activeLang !== lang.code && <span className="text-[10px] uppercase font-mono text-muted-foreground">Installed</span>}
              {lang.status === "downloading" && <span className="text-[10px] uppercase font-mono text-blue-500 animate-pulse">Downloading...</span>}
              {lang.status === "available" && <span className="text-[10px] uppercase font-mono text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground">Download</span>}
            </div>
          ))}
        </div>
      </div>
    </FeatureGate>
  );
}
