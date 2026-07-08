"use client";

import React, { useState, useRef } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiDownload, FiSearch, FiCode } from "react-icons/fi";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function SkillLibraryModule() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [skills] = useState([
    { id: 1, name: "Weather Integration", category: "Utility", author: "G1 Core", installed: true },
    { id: 2, name: "Calendar Management", category: "Productivity", author: "G1 Core", installed: false },
    { id: 3, name: "Spotify Controller", category: "Entertainment", author: "Community", installed: false },
    { id: 4, name: "Smart Home Sync", category: "IoT", author: "G1 Core", installed: true },
  ]);

  useGSAP(() => {
    if (skills.length > 0) {
      gsap.fromTo(
        ".skill-card",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
      );
    }
  }, { dependencies: [skills], scope: containerRef });

  return (
    <FeatureGate featureKey="skillLibrary">
      <div ref={containerRef} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="relative w-full sm:w-96">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search skills..."
              className="w-full bg-card border border-border pl-12 pr-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors rounded-lg shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <div 
              key={skill.id}
              className="skill-card p-6 border border-border bg-card/30 rounded-xl hover:bg-card/60 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary">
                    <FiCode size={20} />
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground border border-border px-2 py-1 rounded">
                    {skill.category}
                  </span>
                </div>
                <h3 className="font-bold text-lg">{skill.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">By {skill.author}</p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-border">
                {skill.installed ? (
                  <button className="w-full py-2 bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wider rounded transition-colors" disabled>
                    Installed
                  </button>
                ) : (
                  <button className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2">
                    <FiDownload size={14} /> Install
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeatureGate>
  );
}
