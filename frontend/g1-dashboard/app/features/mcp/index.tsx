"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { useMcpState } from "./hooks/useMcpState";
import { McpHeader } from "./components/McpHeader";
import { IntegrationCard } from "./components/IntegrationCard";
import { ConfigModal } from "./components/ConfigModal";

export function McpModule() {
  const {
    integrations,
    loading,
    configuringId,
    setConfiguringId,
    formValues,
    setFormValues,
    saving,
    handleToggle,
    handleConfigureClick,
    handleSaveConfig
  } = useMcpState();

  const handleFormChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <FeatureGate featureKey="mcp">
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        <McpHeader />

        <section id="integrations" className="scroll-mt-28 min-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center p-24 text-muted-foreground font-mono text-sm">
              <svg className="animate-spin w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Loading integrations...
            </div>
          ) : integrations.length === 0 ? (
            <div className="p-12 text-center border border-border bg-card/20 text-muted-foreground font-mono text-sm">
              // No integrations available or failed to connect to MCP manager
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.map(integration => (
                <IntegrationCard 
                  key={integration.id} 
                  integration={integration} 
                  onToggle={handleToggle} 
                  onConfigure={handleConfigureClick} 
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfigModal 
        configuringId={configuringId}
        integrations={integrations}
        formValues={formValues}
        saving={saving}
        onClose={() => setConfiguringId(null)}
        onFormChange={handleFormChange}
        onSave={handleSaveConfig}
      />
    </FeatureGate>
  );
}