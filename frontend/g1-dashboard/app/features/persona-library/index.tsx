"use client";

import React, { useState, useRef } from "react";
import { FiTrash2, FiMoreHorizontal, FiCpu, FiCheckCircle, FiSave, FiRefreshCw, FiX } from "react-icons/fi";
import { usePersonaContext } from "../persona/context";
import { FeatureGate } from "@/app/components/feature-gate";
import { api } from "@/lib/api";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function PersonaLibraryModule() {
  const { personas, fetchPersonas, openRoleBuilder } = usePersonaContext();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const personalPersonas = personas.filter(p => !p.isTemplate);
    if (personalPersonas.length > 0) {
      gsap.fromTo(
        ".persona-row",
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out" }
      );
    }
  }, { dependencies: [personas], scope: containerRef });

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this persona?")) return;
    try {
      await api.deletePersona(id);
      await fetchPersonas();
      if (selectedPersona?.id === id) setActiveDialog(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeploy = async (id: string) => {
    setSaving(true);
    try {
      await api.deployPersona(id);
      await fetchPersonas();
      setActiveDialog(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="pt-8 border-t border-border">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[LIB]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Personal Persona Library</h2>
        </div>
        
        {personas.filter(p => !p.isTemplate).length === 0 ? (
          <p className="text-muted-foreground text-sm font-mono p-8 border border-dashed border-border text-center">No personal personas found. Create one using the Role Builder or select a Template.</p>
        ) : (
          <div className="w-full border border-border rounded-xl overflow-hidden bg-card/30">
            {/* Table Header */}
            <div 
              className="grid gap-4 p-4 border-b border-border bg-muted/50 text-xs font-mono text-muted-foreground uppercase tracking-wider"
              style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr 120px" }}
            >
              <div>Profile Name</div>
              <div>Robot / Role</div>
              <div>Company / Location</div>
              <div className="text-center">Status</div>
              <div className="text-right pr-4">Actions</div>
            </div>

            {/* Table Body */}
            <div ref={containerRef} className="flex flex-col">
              {personas.filter(p => !p.isTemplate).map((p) => (
                <div 
                  key={p.id}
                  onClick={() => {
                    setSelectedPersona(p);
                    setActiveDialog("library_details");
                  }}
                  style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr 120px" }}
                  className={`persona-row grid gap-4 p-4 items-center border-b border-border/50 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                    p.isActive ? 'border-l-4 border-l-primary bg-primary/10' : 'border-l-4 border-l-transparent hover:border-l-primary/60 hover:bg-primary/10'
                  }`}
                >
                  <div className="font-bold text-foreground truncate flex items-center gap-2">
                    <FiCpu className={p.isActive ? "text-primary" : "text-muted-foreground"} />
                    {p.name}
                  </div>
                  <div className="flex flex-col text-sm truncate">
                    <span className="text-foreground">{p.robotName || '-'}</span>
                    <span className="text-muted-foreground text-xs">{p.robotRole || '-'}</span>
                  </div>
                  <div className="flex flex-col text-sm truncate">
                    <span className="text-foreground">{p.robotCompany || '-'}</span>
                    <span className="text-muted-foreground text-xs">{p.robotLocation || '-'}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    {p.isActive ? (
                      <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 px-3 py-1 rounded-md shadow-[0_0_10px_rgba(0,118,255,0.1)] w-[88px] justify-start">
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Active</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-1 rounded-md w-[88px] justify-start">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0"></span>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Saved</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end pr-2 gap-2">
                    {!p.isActive && (
                      <button 
                        onClick={(e) => handleDelete(p.id, e)}
                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                        title="Delete Persona"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                    <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
                      <FiMoreHorizontal size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Details Dialog */}
      {activeDialog === "library_details" && selectedPersona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-background border border-border w-full max-w-3xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wider">{selectedPersona.name}</h2>
                <div className="flex gap-2 mt-2">
                  {selectedPersona.isActive && <span className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2 py-1 rounded font-bold">Currently Active on Robot</span>}
                  {selectedPersona.isTemplate && <span className="bg-secondary text-secondary-foreground text-[10px] uppercase tracking-wider px-2 py-1 rounded font-bold">Template</span>}
                </div>
              </div>
              <button 
                onClick={() => setActiveDialog(null)}
                className="p-3 bg-secondary/50 hover:bg-secondary rounded-full transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="p-6 sm:p-10 space-y-8">
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div><span className="text-muted-foreground block mb-1">Robot Name</span>{selectedPersona.robotName || '-'}</div>
                <div><span className="text-muted-foreground block mb-1">Role</span>{selectedPersona.robotRole || '-'}</div>
                <div><span className="text-muted-foreground block mb-1">Company</span>{selectedPersona.robotCompany || '-'}</div>
                <div><span className="text-muted-foreground block mb-1">Location</span>{selectedPersona.robotLocation || '-'}</div>
              </div>

              <div>
                <span className="text-muted-foreground font-mono text-xs block mb-2 uppercase">System Prompt</span>
                <div className="bg-card/50 p-4 border border-border text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {selectedPersona.systemPrompt || 'No prompt defined.'}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground font-mono text-xs block mb-2 uppercase">
                  Rules ({(() => {
                    try { return typeof selectedPersona.conversationRules === 'string' ? JSON.parse(selectedPersona.conversationRules).length : (selectedPersona.conversationRules?.length || 0); } catch(e) { return 0; }
                  })()})
                </span>
                <ul className="list-disc pl-5 text-sm font-mono space-y-1">
                  {(() => {
                    let rules = [];
                    try {
                      rules = typeof selectedPersona.conversationRules === 'string' ? JSON.parse(selectedPersona.conversationRules) : (selectedPersona.conversationRules || []);
                    } catch(e) {}
                    return Array.isArray(rules) ? rules.map((r: any, i: number) => <li key={i}>{typeof r === 'string' ? r : r.rule}</li>) : null;
                  })()}
                </ul>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-background/95 backdrop-blur z-10 border-t border-border p-6 flex justify-between items-center">
              <div>
                {!selectedPersona.isTemplate && (
                  <FeatureGate featureKey="personaChange">
                    <button 
                      onClick={() => {
                        openRoleBuilder(selectedPersona);
                        setActiveDialog(null);
                      }}
                      className="text-sm font-mono text-primary hover:underline"
                    >
                      Edit Persona
                    </button>
                  </FeatureGate>
                )}
              </div>
              <div className="flex gap-4">
                {!selectedPersona.isTemplate && !selectedPersona.isActive && (
                  <button 
                    onClick={(e) => handleDelete(selectedPersona.id, e)}
                    className="px-6 py-3 font-semibold uppercase tracking-wider text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button 
                  onClick={() => handleDeploy(selectedPersona.id)}
                  disabled={saving || selectedPersona.isActive}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg hover:-translate-y-0.5"
                >
                  {saving ? <FiRefreshCw className="animate-spin" /> : (selectedPersona.isActive ? <FiCheckCircle /> : <FiSave />)}
                  {selectedPersona.isActive ? "Already Active" : "Deploy to Robot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
