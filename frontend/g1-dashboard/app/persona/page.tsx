"use client";

import React, { useState, useEffect } from "react";
import { FiSave, FiPlus, FiTrash2, FiRefreshCw } from "react-icons/fi";

export default function PersonaManagerPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/persona");
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      // Added a slight delay for UI feedback
      setTimeout(() => setSaving(false), 500);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const updateIdentity = (field: string, value: string) => {
    setConfig({
      ...config,
      identity: { ...config.identity, [field]: value },
    });
  };

  const updateRule = (index: number, value: string) => {
    const newRules = [...config.conversation_rules];
    newRules[index] = value;
    setConfig({ ...config, conversation_rules: newRules });
  };

  const addRule = () => {
    setConfig({
      ...config,
      conversation_rules: [...config.conversation_rules, ""],
    });
  };

  const removeRule = (index: number) => {
    const newRules = [...config.conversation_rules];
    newRules.splice(index, 1);
    setConfig({ ...config, conversation_rules: newRules });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8 flex items-center justify-center min-h-[50vh]">
        <FiRefreshCw className="animate-spin text-primary text-3xl" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-red-500">
          Failed to load config
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
      <div className="border-b border-border pb-6 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
            Persona Manager
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
            SYS.CONFIG // Configure system parameters and operational protocols
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <FiRefreshCw className="animate-spin" /> : <FiSave />}
          {saving ? "Deploying..." : "Deploy to Robot"}
        </button>
      </div>

      <section id="identity" className="min-h-[30vh] border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[01]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Core Identity</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-border bg-card/20">
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Robot Name</label>
            <input 
              className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
              value={config.identity?.name || ""}
              onChange={(e) => updateIdentity("name", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Company</label>
            <input 
              className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
              value={config.identity?.company || ""}
              onChange={(e) => updateIdentity("company", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Location</label>
            <input 
              className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
              value={config.identity?.location || ""}
              onChange={(e) => updateIdentity("location", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Role</label>
            <input 
              className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
              value={config.identity?.role || ""}
              onChange={(e) => updateIdentity("role", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section id="system-prompt" className="min-h-[30vh] border-t border-border pt-8 scroll-mt-28">
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
            value={config.system_prompt || ""}
            onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
          />
        </div>
      </section>

      <section id="rules" className="min-h-[30vh] border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-primary font-mono text-sm">[03]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Conversation Rules</h2>
        </div>
        
        <div className="p-6 border border-border bg-card/20 space-y-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">
            Behavioral Constraints (Injected dynamically)
          </p>
          
          {config.conversation_rules?.map((rule: string, idx: number) => (
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
  );
}