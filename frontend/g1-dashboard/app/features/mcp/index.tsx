"use client";

import React, { useRef, useEffect, useState } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { useMcpState } from "./hooks/useMcpState";
import { McpHeader } from "./components/McpHeader";
import { IntegrationCard } from "./components/IntegrationCard";
import { ConfigModal } from "./components/ConfigModal";
import { api as coreApi } from "@/lib/api";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function McpModule() {
  const containerRef = useRef<HTMLDivElement>(null);
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

  // ── Fetch official Composio toolkit logo URLs once on mount ─────────────────
  // Uses GET /mcp/logos which calls Composio's toolkit API (GET /api/v3.1/toolkits/{slug})
  // and returns a map of { slug: logo_url } with the real logo for each app.
  const [logosMap, setLogosMap] = useState<Record<string, string>>({});
  useEffect(() => {
    coreApi.getToolkitLogos()
      .then((res: any) => {
        const logos = res?.data?.logos || res?.logos || {};
        setLogosMap(logos);
      })
      .catch((e: any) => console.warn("[MCP] Could not fetch toolkit logos:", e));
  }, []);

  useGSAP(() => {
    if (!loading && integrations.length > 0) {
      gsap.fromTo(
        ".mcp-card",
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.2)",
          stagger: 0.05,
        }
      );
    }
  }, { dependencies: [loading, integrations], scope: containerRef });

  const handleFormChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <FeatureGate featureKey="mcp">
      <div className="max-w-[1600px] mx-auto space-y-16 pb-32 pt-8 px-6 lg:px-12">
        <McpHeader />

        <section id="integrations" ref={containerRef} className="scroll-mt-28 min-h-[50vh]">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
              {integrations.map(integration => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  logosMap={logosMap}
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