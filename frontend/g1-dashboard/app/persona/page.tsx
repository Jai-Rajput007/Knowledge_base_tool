"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FiSave, FiPlus, FiTrash2, FiRefreshCw, FiCheck, FiAlertCircle } from "react-icons/fi";

type SaveResult = { success: boolean; robot_synced: boolean; message: string; version?: number } | null;

export default function PersonaManagerPage() {
  const [config, setConfig]       = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [source, setSource]       = useState<"robot" | "db" | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult>(null);
  const [unsaved, setUnsaved]     = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setSaveResult(null);
    try {
      const res  = await fetch("/api/persona");
      const data = await res.json();
      if (res.ok && !data.error) {
        setConfig(data);
        setSource(data._source ?? null);
        setUnsaved(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const payload = {
        identity:           config.identity,
        system_prompt:      config.system_prompt,
        conversation_rules: config.conversation_rules,
      };
      const res  = await fetch("/api/persona", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      setSaveResult({
        success:      res.ok && data.success,
        robot_synced: data.robot_synced ?? false,
        message:      data.message ?? (res.ok ? "Saved" : data.error ?? "Save failed"),
        version:      data.version,
      });
      if (res.ok) setUnsaved(false);
    } catch (e) {
      setSaveResult({ success: false, robot_synced: false, message: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const markUnsaved = () => { setUnsaved(true); setSaveResult(null); };

  const updateIdentity = (field: string, value: string) => {
    setConfig({ ...config, identity: { ...config.identity, [field]: value } });
    markUnsaved();
  };

  const updateRule = (index: number, value: string) => {
    const r = [...config.conversation_rules];
    r[index] = value;
    setConfig({ ...config, conversation_rules: r });
    markUnsaved();
  };

  const addRule = () => {
    setConfig({ ...config, conversation_rules: [...(config.conversation_rules || []), ""] });
    markUnsaved();
  };

  const removeRule = (index: number) => {
    const r = [...config.conversation_rules];
    r.splice(index, 1);
    setConfig({ ...config, conversation_rules: r });
    markUnsaved();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto pb-32 pt-8 flex items-center justify-center min-h-[50vh]">
        <FiRefreshCw className="animate-spin text-primary text-3xl" />
      </div>
    );
  }

  if (!config || config.error) {
    return (
      <div className="max-w-6xl mx-auto pb-32 pt-8 space-y-4">
        <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">Persona Manager</h1>
        <div className="border border-red-400/30 bg-red-400/5 p-6">
          <p className="font-mono text-sm text-red-400">
            {config?.error ?? "Failed to load persona"}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            Make sure robot_sync.py is running on the AGX (port 9000)
          </p>
          <button onClick={fetchConfig} className="mt-4 px-4 py-2 border border-border font-mono text-xs uppercase hover:border-primary transition-colors">
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32 pt-8">

      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
              Persona Manager
            </h1>
            <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
              SYS.CONFIG // Robot identity, system prompt and behaviour
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchConfig}
              className="p-2 border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              title="Reload from robot"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-sm uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <FiRefreshCw className="animate-spin w-4 h-4" /> : <FiSave className="w-4 h-4" />}
              {saving ? "SYNCING..." : "SAVE & SYNC TO ROBOT"}
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

        {/* Warning if reading from DB fallback */}
        {source === "db" && config._warning && (
          <div className="mt-3 border border-yellow-400/20 bg-yellow-400/5 px-4 py-2">
            <p className="font-mono text-[10px] text-yellow-400">{config._warning}</p>
          </div>
        )}
      </div>

      {/* [01] Core Identity */}
      <section id="identity" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-primary font-mono text-sm">[01]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Core Identity</h2>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground uppercase mb-6">
          // Used in system prompt as {"{name}"}, {"{company}"}, {"{location}"}, {"{role}"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 border border-border bg-card/20">
          {[
            { key: "name",     label: "Robot Name",     placeholder: "Jai" },
            { key: "company",  label: "Company",        placeholder: "Medikold Hospital" },
            { key: "location", label: "Location",       placeholder: "Main Reception, Floor 1" },
            { key: "role",     label: "Role",           placeholder: "Reception assistant robot" },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-2">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</label>
              <input
                className="w-full bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                placeholder={placeholder}
                value={config.identity?.[key] || ""}
                onChange={(e) => updateIdentity(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* [02] System Prompt */}
      <section id="system-prompt" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-primary font-mono text-sm">[02]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">System Prompt</h2>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground uppercase mb-6">
          // Sent to LLM before every conversation. Use {"{name}"} etc. as placeholders.
        </p>

        <div className="p-6 border border-border bg-card/20">
          <textarea
            className="w-full h-48 bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
            value={config.system_prompt || ""}
            onChange={(e) => { setConfig({ ...config, system_prompt: e.target.value }); markUnsaved(); }}
          />
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            {(config.system_prompt || "").length} chars
          </p>
        </div>
      </section>

      {/* [03] Conversation Rules */}
      <section id="rules" className="border-t border-border pt-8 scroll-mt-28">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-primary font-mono text-sm">[03]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Conversation Rules</h2>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground uppercase mb-6">
          // Injected dynamically to constrain robot behaviour during conversation
        </p>

        <div className="p-6 border border-border bg-card/20 space-y-3">
          {(config.conversation_rules || []).map((rule: string, idx: number) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="text-primary font-mono text-[10px] mt-3.5 w-6 shrink-0">#{idx + 1}</span>
              <textarea
                className="flex-1 bg-background border border-border px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors resize-none h-16"
                value={rule}
                onChange={(e) => updateRule(idx, e.target.value)}
              />
              <button
                onClick={() => removeRule(idx)}
                className="p-2 mt-2 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={addRule}
            className="mt-2 flex items-center gap-2 text-primary font-mono text-xs uppercase hover:opacity-70 transition-opacity"
          >
            <FiPlus className="w-3 h-3" /> ADD RULE
          </button>
        </div>
      </section>

      {/* Bottom save bar */}
      {unsaved && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-card border border-border px-5 py-3 shadow-xl">
          <span className="font-mono text-xs text-yellow-400 uppercase">Unsaved changes</span>
          <button
            onClick={handleSave}
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