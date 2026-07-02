import React from "react";
import { FiSave, FiPlus, FiTrash2, FiRefreshCw, FiX } from "react-icons/fi";
import { FeatureGate } from "@/app/components/feature-gate";

interface RoleBuilderModalProps {
  isRoleBuilderOpen: boolean;
  closeRoleBuilder: () => void;
  editForm: any;
  setEditForm: (form: any) => void;
  markUnsaved: () => void;
  updateIdentity: (field: string, value: string) => void;
  updateRule: (index: number, value: string) => void;
  addRule: () => void;
  removeRule: (index: number) => void;
  handleCreateOrUpdate: () => void;
  saving: boolean;
  availableWakewords: any[];
}

export function RoleBuilderModal({
  isRoleBuilderOpen, closeRoleBuilder, editForm, setEditForm, markUnsaved,
  updateIdentity, updateRule, addRule, removeRule, handleCreateOrUpdate, saving, availableWakewords
}: RoleBuilderModalProps) {
  if (!isRoleBuilderOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-background border border-border w-full max-w-5xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
        <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-wider">{editForm.id ? "Edit Persona" : "Role Builder"}</h2>
            <p className="text-xs font-mono text-muted-foreground uppercase">{editForm.id ? "Update configuration" : "Create new configuration"}</p>
          </div>
          <button 
            onClick={closeRoleBuilder}
            className="p-3 bg-secondary/50 hover:bg-secondary rounded-full transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>
        
        <div className="p-6 sm:p-10 space-y-12">
          <section>
            <label className="text-xs font-mono text-primary uppercase tracking-wider mb-2 block">Internal Profile Name</label>
            <input 
              className="w-full bg-card border border-border px-4 py-3 text-foreground font-bold text-lg focus:outline-none focus:border-primary transition-colors"
              value={editForm.name}
              onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); markUnsaved(); }}
              placeholder="e.g. My Custom Receptionist"
            />
          </section>

          <section id="identity">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-primary font-mono text-sm">[01]</span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Core Identity</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-border bg-card/20">
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Robot Name</label>
                <input 
                  className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                  value={editForm.identity?.name || ""}
                  onChange={(e) => updateIdentity("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Company</label>
                <input 
                  className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                  value={editForm.identity?.company || ""}
                  onChange={(e) => updateIdentity("company", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Location</label>
                <input 
                  className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                  value={editForm.identity?.location || ""}
                  onChange={(e) => updateIdentity("location", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Role</label>
                <input 
                  className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                  value={editForm.identity?.role || ""}
                  onChange={(e) => updateIdentity("role", e.target.value)}
                />
              </div>
              
              <FeatureGate featureKey="voiceSettings">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Voice</label>
                  <select
                    className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                    value={editForm.identity?.voice || "Male"}
                    onChange={(e) => updateIdentity("voice", e.target.value)}
                  >
                    <option value="Male">Male Voice</option>
                    <option value="Female">Female Voice</option>
                  </select>
                </div>
              </FeatureGate>

              <FeatureGate featureKey="wakeWordSettings">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Wake Word</label>
                  <select
                    className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                    value={editForm.wakeWord || "hey_jarvis"}
                    onChange={(e) => {
                      setEditForm({ ...editForm, wakeWord: e.target.value });
                      markUnsaved();
                    }}
                  >
                    {availableWakewords.length > 0 ? (
                      availableWakewords.map(ww => (
                        <option key={ww.filename} value={ww.filename}>{ww.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="hey_jarvis">Hey Jarvis</option>
                        <option value="hey_daksh">Hey Daksh</option>
                      </>
                    )}
                  </select>
                </div>
              </FeatureGate>
            </div>
          </section>

          <section id="system-prompt">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-primary font-mono text-sm">[02]</span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Base System Prompt</h2>
            </div>
            
            <div className="p-6 border border-border bg-card/20">
              <label className="block text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                Master Instructions (Passed to LLM)
              </label>
              <textarea 
                className="w-full h-40 bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors resize-none"
                value={editForm.system_prompt || ""}
                onChange={(e) => { setEditForm({ ...editForm, system_prompt: e.target.value }); markUnsaved(); }}
              />
            </div>
          </section>

          <section id="rules">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-primary font-mono text-sm">[03]</span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Conversation Rules</h2>
            </div>
            
            <div className="p-6 border border-border bg-card/20 space-y-4">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
                Behavioral Constraints (Injected dynamically)
              </p>
              
              {editForm.conversation_rules?.map((rule: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="text-primary font-mono text-xs mt-3">#{idx + 1}</span>
                  <textarea 
                    className="flex-1 bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors resize-none h-16"
                    value={rule}
                    onChange={(e) => updateRule(idx, e.target.value)}
                  />
                  <button 
                    onClick={() => removeRule(idx)}
                    className="p-3 mt-1 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Remove Rule"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}

              <button 
                onClick={addRule}
                className="mt-6 flex items-center gap-2 text-primary font-mono text-xs uppercase hover:underline"
              >
                <FiPlus /> Add Rule
              </button>
            </div>
          </section>
        </div>
        
        <div className="sticky bottom-0 bg-background/95 backdrop-blur z-10 border-t border-border p-6 flex justify-end gap-4">
          <button 
            onClick={closeRoleBuilder}
            className="px-6 py-3 font-semibold uppercase tracking-wider text-sm hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreateOrUpdate}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg hover:-translate-y-0.5"
          >
            {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
            {editForm.id ? "Save Changes" : "Create Persona"}
          </button>
        </div>
      </div>
    </div>
  );
}
