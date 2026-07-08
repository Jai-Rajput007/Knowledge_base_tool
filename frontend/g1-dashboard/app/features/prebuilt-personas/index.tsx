"use client";

import React, { useState } from "react";
import { FiX } from "react-icons/fi";
import { Floating3DCard } from "@/app/components/ui/3d-card";
import { FeatureGate } from "@/app/components/feature-gate";
import { usePersonaContext } from "../persona/context";
import { api } from "@/lib/api";

export function PrebuiltPersonasModule() {
  const { personas, fetchPersonas } = usePersonaContext();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCloneTemplate = async (template: any) => {
    setSaving(true);
    try {
      const clonedData = {
        name: template.name + " (Copy)",
        robotName: template.robotName,
        robotCompany: template.robotCompany,
        robotLocation: template.robotLocation,
        robotRole: template.robotRole,
        systemPrompt: template.systemPrompt,
        conversationRules: template.conversationRules
      };
      
      const res = await api.createPersona(clonedData);
      
      if (!res.error) {
        await fetchPersonas();
        setIsOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FeatureGate featureKey="prebuiltPersonas">
        <Floating3DCard 
          title="Persona Templates"
          description="Quickly switch between pre-configured specialized roles like Receptionist, Tour Guide, or Security Officer."
          imageSrc="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
          buttonText="Browse"
          onButtonClick={() => setIsOpen(true)}
        />
      </FeatureGate>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-background border border-border w-full max-w-4xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wider">Persona Templates</h2>
                <p className="text-xs font-mono text-muted-foreground uppercase">Select a template to clone into your Personal Library</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-3 bg-secondary/50 hover:bg-secondary rounded-full transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="p-6 sm:p-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {personas.filter(p => p.isTemplate).map(t => (
                  <div key={t.id} className="p-6 rounded-xl border border-border bg-card/50 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg mb-2">{t.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono mb-4">{t.systemPrompt.substring(0, 100)}...</p>
                      <ul className="text-xs font-mono text-foreground space-y-1 mb-6">
                        <li><strong>Role:</strong> {t.robotRole}</li>
                        <li><strong>Location:</strong> {t.robotLocation}</li>
                      </ul>
                    </div>
                    <button 
                      onClick={() => handleCloneTemplate(t)}
                      disabled={saving}
                      className="w-full py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold uppercase tracking-wider rounded transition-colors"
                    >
                      {saving ? "Cloning..." : "Add to Library"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
