"use client";

import { ShieldCheck, Search, SlidersHorizontal } from "lucide-react";

export default function PermissionsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Permissions & Features</h1>
          <p className="text-foreground/50 mt-1">Globally manage feature flags and access controls across all tenants.</p>
        </div>
        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          New Feature Flag
        </button>
      </div>

      <div className="bg-foreground/5 border border-foreground/10 rounded-2xl overflow-hidden shadow-lg shadow-black/5">
        <div className="p-5 border-b border-foreground/10 bg-foreground/5 flex items-center justify-between">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input 
              type="text" 
              placeholder="Search features..." 
              className="pl-9 pr-4 py-2 bg-background border border-foreground/10 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <button className="p-2 border border-foreground/10 rounded-lg hover:bg-foreground/5 text-foreground/70 transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-foreground/10">
          {[
            { id: "personaChange", name: "Persona Change Through UI", desc: "Allow changing system prompt, M/F voice, conversation rules, and wakeword.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "prebuiltPersonas", name: "Prebuilt Persona Templates", desc: "Provide a choice from prebuilt persona templates.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "generativePersona", name: "Generative Persona", desc: "Enable AI-generated dynamic agent personalities.", enabled: 0, total: 1, type: "Beta" },
            { id: "mcp", name: "MCP Integration", desc: "Enable basic and agentic Model Context Protocol capabilities.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "wakeWordSettings", name: "Wake Word Settings", desc: "Allow wake word change and custom training settings.", enabled: 0, total: 1, type: "Enterprise Only" },
            { id: "voiceSettings", name: "Voice Settings", desc: "Advanced voice settings (Sample rate, pitch, volume, speed).", enabled: 0, total: 1, type: "Core Feature" },
            { id: "chatSimulator", name: "Chat Simulator", desc: "Enable the chat simulator for testing and debugging.", enabled: 0, total: 1, type: "Developer Tool" },
            { id: "rag", name: "RAG Capabilities", desc: "Enable Document RAG and Web page RAG capabilities.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "rbac", name: "RBAC Control", desc: "Enable Role-Based Access Control configuration.", enabled: 0, total: 1, type: "Enterprise Only" },
            { id: "configurationGestures", name: "Configuration Gestures", desc: "Configure physical UI gestures (Add, Delete, Create via library).", enabled: 0, total: 1, type: "Beta" },
            { id: "rollback", name: "Rollback", desc: "Allow rolling back to previous configurations and states.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "auditing", name: "Auditing & Logs", desc: "Audit every action and provide detailed system logs.", enabled: 0, total: 1, type: "Enterprise Only" },
            { id: "multilingual", name: "Multilingual Support", desc: "Enable multiple languages for communication.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "internationalLanguage", name: "International Language", desc: "Enable non-Indic languages (German, French, Arabic, etc.) for speech recognition and interaction.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "skillLibrary", name: "Skill Library", desc: "Provide access to the expanded robot skill library.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "webhook", name: "Webhooks", desc: "Enable custom webhooks for integrations.", enabled: 0, total: 1, type: "Developer Tool" },
            { id: "healthStats", name: "Health Stats", desc: "Display real-time robot health statistics and metrics.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "otaUpdates", name: "OTA Updates", desc: "Enable Over-The-Air remote updates for the robots.", enabled: 0, total: 1, type: "Enterprise Only" },
            { id: "emotions", name: "Emotions", desc: "Enable visual and vocal emotional responses while communicating.", enabled: 0, total: 1, type: "Beta" },
            { id: "communicationGestures", name: "Communication Gestures", desc: "Enable physical gestures while the robot is explaining something.", enabled: 0, total: 1, type: "Beta" },
            { id: "navigation", name: "Navigation", desc: "Enable the robot's physical autonomous navigation features.", enabled: 0, total: 1, type: "Enterprise Only" },
            { id: "featureSuggestions", name: "Feature Suggestions", desc: "Provide intelligent feature suggestions according to the specific robot model.", enabled: 0, total: 1, type: "Beta" },
            { id: "frs", name: "Facial Recognition System", desc: "Enable the facial recognition employee tracking module.", enabled: 0, total: 1, type: "Core Feature" },
            { id: "tickets", name: "Support Tickets", desc: "Enable the support ticketing and issue tracking module.", enabled: 0, total: 1, type: "Core Feature" }
          ].map((feature) => (
            <div key={feature.id} className="p-5 flex items-center justify-between hover:bg-foreground/5 transition-colors">
              <div className="flex flex-col gap-1">
                <h3 className="text-foreground font-medium flex items-center gap-2">
                  {feature.name}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/10 border border-foreground/20">{feature.type}</span>
                </h3>
                <p className="text-sm text-foreground/50">{feature.desc}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{feature.enabled} / {feature.total}</p>
                  <p className="text-xs text-foreground/50">Tenants Enabled</p>
                </div>
                <button className="px-4 py-2 border border-foreground/10 rounded-lg hover:bg-background transition-colors text-sm font-medium">
                  Manage Access
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
