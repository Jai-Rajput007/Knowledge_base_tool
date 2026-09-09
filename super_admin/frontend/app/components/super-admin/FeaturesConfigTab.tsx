"use client";

import { useState, useEffect } from "react";
import { Check, X, ShieldAlert, Sparkles } from "lucide-react";

export function FeaturesConfigTab({ tenantId }: { tenantId: string }) {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Define the available features and their descriptions
  const AVAILABLE_FEATURES = [
    { key: "personaChange", name: "Persona Change Through UI", desc: "Allow changing system prompt, M/F voice, conversation rules, and wakeword." },
    { key: "prebuiltPersonas", name: "Prebuilt Persona Templates", desc: "Provide a choice from prebuilt persona templates." },
    { key: "generativePersona", name: "Generative Persona", desc: "Enable AI-generated dynamic agent personalities." },
    { key: "mcp", name: "MCP Integration", desc: "Enable basic and agentic Model Context Protocol capabilities." },
    { key: "wakeWordSettings", name: "Wake Word Settings", desc: "Allow wake word change and custom training settings." },
    { key: "voiceSettings", name: "Voice Settings", desc: "Advanced voice settings (Sample rate, pitch, volume, speed)." },
    { key: "chatSimulator", name: "Chat Simulator", desc: "Enable the chat simulator for testing and debugging." },
    { key: "rag", name: "RAG Capabilities", desc: "Enable Document RAG and Web page RAG capabilities." },
    { key: "rbac", name: "RBAC Control", desc: "Enable Role-Based Access Control configuration." },
    { key: "configurationGestures", name: "Configuration Gestures", desc: "Configure physical UI gestures (Add, Delete, Create via library)." },
    { key: "rollback", name: "Rollback", desc: "Allow rolling back to previous configurations and states." },
    { key: "auditing", name: "Auditing & Logs", desc: "Audit every action and provide detailed system logs." },
    { key: "multilingual", name: "Multilingual Support", desc: "Enable multiple languages for communication." },
    { key: "internationalLanguage", name: "International Language", desc: "Enable non-Indic languages (German, French, Arabic, etc.) for speech recognition and interaction." },
    { key: "skillLibrary", name: "Skill Library", desc: "Provide access to the expanded robot skill library." },
    { key: "webhook", name: "Webhooks", desc: "Enable custom webhooks for integrations." },
    { key: "healthStats", name: "Health Stats", desc: "Display real-time robot health statistics and metrics." },
    { key: "otaUpdates", name: "OTA Updates", desc: "Enable Over-The-Air remote updates for the robots." },
    { key: "emotions", name: "Emotions", desc: "Enable visual and vocal emotional responses while communicating." },
    { key: "communicationGestures", name: "Communication Gestures", desc: "Enable physical gestures while the robot is explaining something." },
    { key: "navigation", name: "Navigation", desc: "Enable the robot's physical autonomous navigation features." },
    { key: "featureSuggestions", name: "Feature Suggestions", desc: "Provide intelligent feature suggestions according to the specific robot model." },
    { key: "frs", name: "Facial Recognition System", desc: "Enable the facial recognition employee tracking module." },
    { key: "tickets", name: "Support Tickets", desc: "Enable the support ticketing and issue tracking module." }
  ];

  useEffect(() => {
    fetchFeatures();
  }, [tenantId]);

  const fetchFeatures = async () => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/features`);
      const data = await res.json();
      setFeatures(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, currentValue: boolean) => {
    const newFeatures = { ...features, [key]: !currentValue };
    setFeatures(newFeatures); // Optimistic UI update
    
    setSaving(true);
    try {
      await fetch(`/api/tenants/${tenantId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFeatures),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to update features.");
      setFeatures(features); // Rollback on fail
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = async (enableAll: boolean) => {
    const newFeatures: Record<string, boolean> = {};
    AVAILABLE_FEATURES.forEach(f => {
      newFeatures[f.key] = enableAll;
    });
    setFeatures(newFeatures); // Optimistic UI update
    
    setSaving(true);
    try {
      await fetch(`/api/tenants/${tenantId}/features`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFeatures),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to update features.");
      setFeatures(features); // Rollback on fail
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-muted rounded w-1/3"></div>
      <div className="h-32 bg-muted rounded w-full"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl gap-4">
        <div>
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Platform Features
          </h3>
          <p className="text-xs text-blue-400/80 mt-1">
            Toggle global platform capabilities for this specific tenant. These apply across all their users and robots.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            disabled={saving}
            onClick={() => handleToggleAll(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
          >
            Enable All
          </button>
          <button
            disabled={saving}
            onClick={() => handleToggleAll(false)}
            className="px-3 py-1.5 text-xs font-semibold bg-foreground/5 text-foreground/70 border border-foreground/10 hover:bg-foreground/10 rounded-lg transition-colors disabled:opacity-50"
          >
            Disable All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AVAILABLE_FEATURES.map((feature) => {
          const isEnabled = features[feature.key] || false;
          return (
            <div 
              key={feature.key} 
              className={`p-5 rounded-xl border transition-all ${
                isEnabled 
                  ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                  : "border-foreground/10 bg-foreground/5 hover:bg-foreground/10"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{feature.name}</h4>
                  <p className="text-xs text-foreground/60 mt-1 leading-relaxed">{feature.desc}</p>
                </div>
                
                {/* Toggle Switch */}
                <button
                  disabled={saving}
                  onClick={() => handleToggle(feature.key, isEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    isEnabled ? 'bg-purple-500' : 'bg-foreground/20'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-background border border-foreground/10 shadow ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
