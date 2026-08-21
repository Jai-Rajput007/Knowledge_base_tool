"use client";

import React, { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { gsap } from 'gsap';
import { FeatureStatusCard } from "./components/feature-status-card";
import { LazySection } from "@/components/ui/lazy-section";
import { Database, Bot, Users, MapPin, Mic, Blocks, ShieldCheck, MessageSquare, Hand } from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";

// Fetcher defined OUTSIDE the component so its reference never changes between renders.
// If defined inside, SWR would see a new function each render and re-fetch unnecessarily.
const createFetcher = () => async (url: string) => {
  const token = api.getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${url}`, { headers });
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  return res.json();
};

const fetcher = createFetcher();

export default function ClientDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // SWR hooks for parallel, non-blocking fetching
  const { data: healthData, error: healthError } = useSWR('/gestures/health', fetcher);
  // /robot/status is answered by the AGX Thor's own robot_sync process, which
  // pings the G1's onboard PC1 directly — the backend has no network route to
  // the robot's DDS subnet, so it cannot check this itself. Poll every 5s so a
  // powered-off robot doesn't sit on a stale ONLINE reading.
  const { data: robotStatusData, error: robotStatusError } = useSWR(
    '/robot/status', fetcher, { refreshInterval: 5000 }
  );
  const { data: dashStats } = useSWR('/dashboard/stats', fetcher);
  const { data: activePersona } = useSWR('/personas/persona', fetcher); // Or /active, check api.ts if this fails. Usually /personas is enough
  const { data: personasData } = useSWR('/personas/', fetcher);
  const { data: employeesData } = useSWR('/employees/', fetcher);
  const { data: mapsData } = useSWR('/navigation/locations', fetcher);
  const { data: mcpData } = useSWR('/mcp/integrations', fetcher);
  const { data: auditData } = useSWR('/audit/logs', fetcher);
  const { data: chatData } = useSWR('/sessions/', fetcher);
  const { data: gesturesData, error: gesturesError } = useSWR('/gestures/custom', fetcher);

  // Derived state from SWR data
  const agxStatus = healthError ? "offline" : healthData ? "online" : "offline";
  // Previously this was `const robotStatus = agxStatus` — the robot indicator
  // was a literal copy of the AGX indicator, so a powered-off G1 still showed
  // ONLINE as long as the Thor itself was reachable. Now sourced from the
  // backend's /robot/status, which pings the robot's own IP (192.168.123.164)
  // from the Thor. "unknown" (not "online") when that check can't be reached
  // at all — that ambiguity is the actual bug being fixed here.
  const robotStatus: "online" | "offline" | "unknown" = robotStatusError
    ? "unknown"
    : robotStatusData?.robot?.status ?? "unknown";

  const ragStats = { docs: dashStats?.totalDocuments || 0 };
  const personaStats = { 
    active: activePersona?.identity?.name || "None", 
    total: Array.isArray(personasData) ? personasData.length : 0 
  };
  
  const employeeCount = Array.isArray(employeesData) ? employeesData.length : 0;
  const mapCount = Array.isArray(mapsData) ? mapsData.length : 0;
  const mcpCount = Array.isArray(mcpData) ? mcpData.filter((m: any) => m.isEnabled).length : 0;
  const auditCount = auditData?.total || 0;
  const chatCount = Array.isArray(chatData) ? chatData.length : 0;
  
  const gesturesOffline = !!gesturesError;
  const gestureCount = Array.isArray(gesturesData) ? gesturesData.length : 0;

  useEffect(() => {
    // Animations
    const ctx = gsap.context(() => {
      gsap.from('.dash-header', { opacity: 0, y: -15, duration: 0.6, ease: 'power3.out', onComplete: () => gsap.set('.dash-header', { clearProps: 'all' }) });
      gsap.from('.dash-widget', { opacity: 0, y: 20, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.2, onComplete: () => gsap.set('.dash-widget', { clearProps: 'all' }) });
      gsap.from('.feature-card', { opacity: 0, y: 15, duration: 0.4, stagger: 0.05, ease: 'power2.out', delay: 0.4, onComplete: () => gsap.set('.feature-card', { clearProps: 'all' }) });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-12 flex flex-col gap-8">
      {/* Page Header */}
      <div className="dash-header flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            VEDA Control Center
          </h1>
          <p className="text-muted-foreground mt-2">{today} — Central Administration</p>
        </div>
        
        {/* Health Status Rows */}
        <div className="flex flex-col gap-3 min-w-[240px]">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border shadow-sm">
            <span className="text-sm font-semibold text-foreground">AGX Health Status</span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${agxStatus === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${agxStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              {agxStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border shadow-sm">
            <span className="text-sm font-semibold text-foreground">Robot Health Status</span>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${
              robotStatus === 'online' ? 'bg-green-500/10 text-green-500'
              : robotStatus === 'unknown' ? 'bg-amber-500/10 text-amber-500'
              : 'bg-red-500/10 text-red-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                robotStatus === 'online' ? 'bg-green-500 animate-pulse'
                : robotStatus === 'unknown' ? 'bg-amber-500'
                : 'bg-red-500'
              }`}></span>
              {robotStatus === 'online' ? 'ONLINE' : robotStatus === 'unknown' ? 'UNKNOWN' : 'OFFLINE'}
            </div>
          </div>
        </div>
      </div>

      {/* Modules Hub */}
      <section className="dash-widget mt-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-6">Preview panel</h2>
        <LazySection rootMargin="100px" minHeight="600px">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <FeatureStatusCard
            title="Knowledge Base (RAG)"
            description="Upload internal documents to provide the robot with contextual business knowledge."
            icon={Database}
            statusText={`${ragStats.docs} Documents Indexed`}
            statusIndicator="success"
            manageLink="/rag"
            docsLink="/documentation#rag"
          />

          <FeatureStatusCard
            title="Persona Engine"
            description="Configure the robot's personality, tone of voice, and behavioral constraints."
            icon={Bot}
            statusText={`Active: ${personaStats.active}`}
            secondaryText={`${personaStats.total} Configured`}
            statusIndicator="neutral"
            manageLink="/persona"
            docsLink="/documentation#persona"
          />

          <FeatureStatusCard
            title="Facial Recognition (FRS)"
            description="Manage employee profiles and automated physical access tracking via facial data."
            icon={Users}
            statusText={`${employeeCount} Profiles Registered`}
            statusIndicator="success"
            manageLink="/employees"
            docsLink="/documentation#frs"
          />

          <FeatureStatusCard
            title="Navigation & Mapping"
            description="Manage saved location maps and send the robot to specific destinations."
            icon={MapPin}
            statusText={`${mapCount} Maps Saved`}
            statusIndicator="success"
            manageLink="/navigation"
            docsLink="/documentation#navigation"
          />

          <FeatureStatusCard
            title="Custom Wakewords"
            description="Train and assign custom voice triggers like 'Hey Veda' or 'Hey G1'."
            icon={Mic}
            statusText="Trigger: 'Hey Veda'"
            statusIndicator="neutral"
            manageLink="/wake-word"
            docsLink="/documentation#wakewords"
          />

          <FeatureStatusCard
            title="Integrations (MCP)"
            description="Connect to third-party APIs (Google Workspace, Jira) to give the robot external tools."
            icon={Blocks}
            statusText={`${mcpCount} Active Integrations`}
            statusIndicator={mcpCount > 0 ? "success" : "neutral"}
            manageLink="/mcp"
            docsLink="/documentation#integrations"
          />

          <FeatureStatusCard
            title="Audit Log"
            description="Track all admin actions, API calls, and configuration changes for compliance."
            icon={ShieldCheck}
            statusText={`${auditCount} Actions Logged`}
            statusIndicator="neutral"
            manageLink="/audit-logs"
            docsLink="/documentation#audit"
          />

          <FeatureStatusCard
            title="Chat Simulator"
            description="Preview and test how the robot responds using your current persona and knowledge base."
            icon={MessageSquare}
            statusText={`${chatCount} Conversations`}
            statusIndicator="neutral"
            manageLink="/chat"
            docsLink="/documentation#chat"
          />

          <FeatureStatusCard
            title="Gesture Library"
            description="Record and manage custom physical gestures for the robot to perform on demand."
            icon={Hand}
            statusText={gesturesOffline ? "AGX Required" : `${gestureCount} Custom Gestures`}
            statusIndicator={gesturesOffline ? "offline" : "success"}
            manageLink="/gestures"
            docsLink="/documentation#gestures"
          />

        </div>
        </LazySection>
      </section>

    </div>
  );
}
