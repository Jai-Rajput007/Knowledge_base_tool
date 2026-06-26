"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FiSave, FiPlus, FiTrash2, FiRefreshCw, FiX, FiCheckCircle, FiCpu, FiMoreHorizontal, FiCheck, FiAlertCircle } from "react-icons/fi";
import { Floating3DCard } from "@/components/ui/3d-card";
import { motion, AnimatePresence } from "framer-motion";

type SaveResult = { success: boolean; robot_synced: boolean; message: string; version?: number } | null;

export default function PersonaManagerPage() {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [source, setSource] = useState<"robot" | "db" | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult>(null);
  const [unsaved, setUnsaved] = useState(false);
  
  // State for the currently edited/viewed persona in dialogs
  const [editForm, setEditForm] = useState<any>({
    name: "",
    identity: { name: "", company: "", location: "", role: "" },
    system_prompt: "",
    conversation_rules: []
  });

  // State for the generative persona form
  const [genForm, setGenForm] = useState({
    name: "",
    robotName: "",
    role: "",
    location: "",
    context: ""
  });
  const [generating, setGenerating] = useState(false);

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/personas");
      const data = await res.json();
      setPersonas(Array.isArray(data) ? data : []);
      
      // Async check for live robot status
      fetch("/api/persona")
        .then(r => r.json())
        .then(d => setSource(d._source || "db"))
        .catch(() => setSource("db"));

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPersonas(); }, [fetchPersonas]);

  const handleCreateOrUpdate = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const method = editForm.id ? "PUT" : "POST";
      const url = editForm.id ? `/api/personas/${editForm.id}` : "/api/personas";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      
      setSaveResult({
        success:      res.ok && (data.success !== false),
        robot_synced: data.robot_synced ?? false,
        message:      data.message ?? (res.ok ? "Saved" : data.error ?? "Save failed"),
        version:      data.version,
      });
      
      await fetchPersonas();
      setActiveDialog(null);
      if (res.ok) setUnsaved(false);
    } catch (e) {
      setSaveResult({ success: false, robot_synced: false, message: "Network error" });
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async (id: string) => {
    setSaving(true);
    try {
      await fetch(`/api/personas/${id}/deploy`, { method: "POST" });
      await fetchPersonas();
      setActiveDialog(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this persona?")) return;
    try {
      await fetch(`/api/personas/${id}`, { method: "DELETE" });
      await fetchPersonas();
      if (editForm?.id === id) setActiveDialog(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genForm),
      });
      if (res.ok) {
        await fetchPersonas();
        setActiveDialog(null);
        setGenForm({ name: "", robotName: "", role: "", location: "", context: "" });
      } else {
        alert("Failed to generate persona");
      }
    } catch (e) {
      console.error(e);
      alert("Error calling generative API");
    } finally {
      setGenerating(false);
    }
  };

  const handleCloneTemplate = async (template: any) => {
    setSaving(true);
    try {
      const clonedData = {
        name: template.name + " (Copy)",
        identity: {
          name: template.robotName,
          company: template.robotCompany,
          location: template.robotLocation,
          role: template.robotRole
        },
        system_prompt: template.systemPrompt,
        conversation_rules: template.conversationRules
      };
      
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clonedData),
      });
      
      if (res.ok) {
        await fetchPersonas();
        setActiveDialog(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const openBuilder = (persona: any = null) => {
    if (persona) {
      setEditForm({
        id: persona.id,
        name: persona.name || "",
        identity: {
          name: persona.robotName || "",
          company: persona.robotCompany || "",
          location: persona.robotLocation || "",
          role: persona.robotRole || ""
        },
        system_prompt: persona.systemPrompt || "",
        conversation_rules: persona.conversationRules || []
      });
    } else {
      setEditForm({
        name: "New Custom Persona",
        identity: { name: "", company: "", location: "", role: "" },
        system_prompt: "",
        conversation_rules: []
      });
    }
    setActiveDialog("role_builder");
  };

  const markUnsaved = () => { setUnsaved(true); setSaveResult(null); };

  const updateIdentity = (field: string, value: string) => {
    setEditForm({
      ...editForm,
      identity: { ...editForm.identity, [field]: value },
    });
    markUnsaved();
  };

  const updateRule = (index: number, value: string) => {
    const newRules = [...editForm.conversation_rules];
    newRules[index] = value;
    setEditForm({ ...editForm, conversation_rules: newRules });
    markUnsaved();
  };

  const addRule = () => {
    setEditForm({
      ...editForm,
      conversation_rules: [...editForm.conversation_rules, ""],
    });
    markUnsaved();
  };

  const removeRule = (index: number) => {
    const newRules = [...editForm.conversation_rules];
    newRules.splice(index, 1);
    setEditForm({ ...editForm, conversation_rules: newRules });
    markUnsaved();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto pb-32 pt-8 flex items-center justify-center min-h-[50vh]">
        <FiRefreshCw className="animate-spin text-primary text-3xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
              Persona Manager
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
              SYS.CONFIG // Configure system parameters and operational protocols
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPersonas}
              className="p-2 border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              title="Reload from robot"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 mt-4">
          {/* Robot source indicator */}
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${source === "robot" ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {source === "robot" ? "Reading from: Robot (live)" : "Reading from: Database (robot offline)"}
            </span>
          </div>

          {/* Unsaved indicator */}
          {unsaved && (
            <span className="font-mono text-[10px] text-yellow-400 uppercase">● Unsaved changes</span>
          )}

          {/* Save result */}
          {saveResult && (
            <div className={`flex items-center gap-2 font-mono text-[10px] uppercase ${saveResult.success ? "text-green-400" : "text-red-400"}`}>
              {saveResult.success ? <FiCheck className="w-3 h-3" /> : <FiAlertCircle className="w-3 h-3" />}
              {saveResult.robot_synced
                ? `✓ Synced to robot (v${saveResult.version}) — hot-reloaded`
                : saveResult.success
                  ? `Saved to DB — ${saveResult.message}`
                  : saveResult.message
              }
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        <Floating3DCard
          title="Role Builder"
          description="Manually configure the robot's Identity, Master Instructions, and Conversation Rules. Create custom roles for any use case."
          imageSrc="https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=800&q=80"
          buttonText="Build Custom →"
          onButtonClick={() => openBuilder(null)}
        />
        
        <Floating3DCard 
          title="Generative Persona"
          description="Use AI to instantly generate a full personality profile from a short description."
          imageSrc="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=800&q=80"
          buttonText="Generate ✨"
          onButtonClick={() => setActiveDialog("generative_persona")}
        />

        <Floating3DCard 
          title="Persona Templates"
          description="Quickly switch between pre-configured specialized roles like Receptionist, Tour Guide, or Security Officer."
          imageSrc="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80"
          buttonText="Browse"
          onButtonClick={() => setActiveDialog("browse_templates")}
        />
      </div>

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
            <motion.div 
              className="flex flex-col"
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.05 } }
              }}
            >
              <AnimatePresence>
                {personas.filter(p => !p.isTemplate).map((p) => (
                  <motion.div 
                    key={p.id}
                    variants={{
                      hidden: { opacity: 0, y: 15 },
                      show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.01, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setEditForm(p);
                      setActiveDialog("library_details");
                    }}
                    style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr 120px" }}
                    className={`grid gap-4 p-4 items-center border-b border-border/50 cursor-pointer transition-colors duration-200 ${
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
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </section>

      {/* Dialog for Browse Templates */}
      {activeDialog === "browse_templates" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-background border border-border w-full max-w-4xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wider">Persona Templates</h2>
                <p className="text-xs font-mono text-muted-foreground uppercase">Select a template to clone into your Personal Library</p>
              </div>
              <button 
                onClick={() => setActiveDialog(null)}
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

      {/* Dialog for Generative Persona */}
      {activeDialog === "generative_persona" && (
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
                onClick={() => setActiveDialog(null)}
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
                onClick={() => setActiveDialog(null)}
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

      {/* Dialog for Role Builder (Create / Edit) */}
      {activeDialog === "role_builder" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-background border border-border w-full max-w-5xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wider">{editForm.id ? "Edit Persona" : "Role Builder"}</h2>
                <p className="text-xs font-mono text-muted-foreground uppercase">{editForm.id ? "Update configuration" : "Create new configuration"}</p>
              </div>
              <button 
                onClick={() => setActiveDialog(null)}
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
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                    onChange={(e) => setEditForm({ ...editForm, system_prompt: e.target.value })}
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
                onClick={() => setActiveDialog(null)}
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
      )}

      {/* Dialog for Persona Details from Library */}
      {activeDialog === "library_details" && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-background border border-border w-full max-w-3xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative">
            <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-wider">{editForm.name}</h2>
                <div className="flex gap-2 mt-2">
                  {editForm.isActive && <span className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2 py-1 rounded font-bold">Currently Active on Robot</span>}
                  {editForm.isTemplate && <span className="bg-secondary text-secondary-foreground text-[10px] uppercase tracking-wider px-2 py-1 rounded font-bold">Template</span>}
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
                <div><span className="text-muted-foreground block mb-1">Robot Name</span>{editForm.robotName || '-'}</div>
                <div><span className="text-muted-foreground block mb-1">Role</span>{editForm.robotRole || '-'}</div>
                <div><span className="text-muted-foreground block mb-1">Company</span>{editForm.robotCompany || '-'}</div>
                <div><span className="text-muted-foreground block mb-1">Location</span>{editForm.robotLocation || '-'}</div>
              </div>

              <div>
                <span className="text-muted-foreground font-mono text-xs block mb-2 uppercase">System Prompt</span>
                <div className="bg-card/50 p-4 border border-border text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {editForm.systemPrompt || 'No prompt defined.'}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground font-mono text-xs block mb-2 uppercase">Rules ({editForm.conversationRules?.length || 0})</span>
                <ul className="list-disc pl-5 text-sm font-mono space-y-1">
                  {editForm.conversationRules?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>
            
            <div className="sticky bottom-0 bg-background/95 backdrop-blur z-10 border-t border-border p-6 flex justify-between items-center">
              <div>
                {!editForm.isTemplate && (
                  <button 
                    onClick={() => {
                      // Map DB model to form format for editing
                      openBuilder(editForm);
                    }}
                    className="text-sm font-mono text-primary hover:underline"
                  >
                    Edit Persona
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                {!editForm.isTemplate && !editForm.isActive && (
                  <button 
                    onClick={(e) => handleDelete(editForm.id, e)}
                    className="px-6 py-3 font-semibold uppercase tracking-wider text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button 
                  onClick={() => handleDeploy(editForm.id)}
                  disabled={saving || editForm.isActive}
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg hover:-translate-y-0.5"
                >
                  {saving ? <FiRefreshCw className="animate-spin" /> : (editForm.isActive ? <FiCheckCircle /> : <FiSave />)}
                  {editForm.isActive ? "Already Active" : "Deploy to Robot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom save bar (from upstream) */}
      {unsaved && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-card border border-border px-5 py-3 shadow-xl">
          <span className="font-mono text-xs text-yellow-400 uppercase">Unsaved changes</span>
          <button
            onClick={handleCreateOrUpdate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-xs uppercase disabled:opacity-50"
          >
            {saving ? <FiRefreshCw className="animate-spin w-3 h-3" /> : <FiSave className="w-3 h-3" />}
            {saving ? "SYNCING..." : "SAVE & SYNC"}
          </button>
        </div>
      )}

    </div>
  );
}