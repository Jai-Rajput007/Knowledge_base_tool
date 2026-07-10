"use client";

import React, { useState } from "react";
import { FiRefreshCw, FiCpu, FiX } from "react-icons/fi";
import { Floating3DCard } from "@/app/components/ui/3d-card";
import { FeatureGate } from "@/app/components/feature-gate";
import { usePersonaContext } from "../persona/context";
import { api } from "@/lib/api";

export function GenerativePersonaModule() {
  const { fetchPersonas } = usePersonaContext();
  const [isOpen, setIsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [genForm, setGenForm] = useState({
    name: "",
    robotName: "",
    role: "",
    location: "",
    context: ""
  });

  const handleGenerate = async () => {
    if (!genForm.name.trim()) {
      alert("Please provide at least an internal name for this profile.");
      return;
    }
    
    setGenerating(true);
    try {
      const res = await api.generatePersona(genForm);
      if ((res.data as any)?.success) {
        await fetchPersonas();
        setIsOpen(false);
        setGenForm({ name: "", robotName: "", role: "", location: "", context: "" });
      } else {
        alert(res.error || "Generation failed.");
      }
    } catch (e) {
      console.error(e);
      alert("Error calling generative API");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <FeatureGate featureKey="generativePersona">
        <Floating3DCard 
          title="Generative Persona"
          description="Use AI to instantly generate a full personality profile from a short description."
          imageSrc="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80"
          buttonText="Generate ✨"
          onButtonClick={() => setIsOpen(true)}
        />
      </FeatureGate>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-background border border-border w-full max-w-2xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <FiCpu /> Generative Persona
                </h2>
                <p className="text-xs font-mono text-muted-foreground uppercase">Powered by Qwen2.5:7b</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-3 bg-secondary/50 hover:bg-secondary rounded-full transition-colors"
                disabled={generating}
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="p-6 sm:p-10 space-y-6">
              <p className="text-sm text-muted-foreground font-mono mb-4">
                Provide a brief description of the robot you want. The AI will automatically generate the identity, system prompt, and strict behavioral rules.
              </p>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">Profile Name</label>
                    <input 
                      className="w-full bg-card border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                      value={genForm.name}
                      onChange={(e) => setGenForm({ ...genForm, name: e.target.value })}
                      placeholder="e.g. Science Tutor AI"
                      disabled={generating}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">Robot Name</label>
                    <input 
                      className="w-full bg-card border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                      value={genForm.robotName}
                      onChange={(e) => setGenForm({ ...genForm, robotName: e.target.value })}
                      placeholder="e.g. EinsteinBot"
                      disabled={generating}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">Role</label>
                    <input 
                      className="w-full bg-card border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                      value={genForm.role}
                      onChange={(e) => setGenForm({ ...genForm, role: e.target.value })}
                      placeholder="e.g. University Tutor"
                      disabled={generating}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2">Location</label>
                    <input 
                      className="w-full bg-card border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                      value={genForm.location}
                      onChange={(e) => setGenForm({ ...genForm, location: e.target.value })}
                      placeholder="e.g. Campus Library"
                      disabled={generating}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block mb-2 text-primary">Context / Personality Description</label>
                  <textarea 
                    className="w-full h-32 bg-card border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                    value={genForm.context}
                    onChange={(e) => setGenForm({ ...genForm, context: e.target.value })}
                    placeholder="Describe the personality, tone, rules, and goals of this robot..."
                    disabled={generating}
                  />
                </div>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-background/95 backdrop-blur z-10 border-t border-border p-6 flex justify-end gap-4">
              <button 
                onClick={() => setIsOpen(false)}
                disabled={generating}
                className="px-6 py-3 font-semibold uppercase tracking-wider text-sm hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerate}
                disabled={generating || !genForm.name || !genForm.context}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg hover:-translate-y-0.5"
              >
                {generating ? <FiRefreshCw className="animate-spin" /> : <FiCpu />}
                {generating ? "Generating..." : "Generate with AI"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
