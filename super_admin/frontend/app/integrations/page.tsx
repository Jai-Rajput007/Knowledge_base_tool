"use client";

import { Database, Plus, Search, Power } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Integrations Handler</h1>
          <p className="text-foreground/50 mt-1">Manage global MCP subscriptions and agentic integrations.</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { name: "GitHub MCP", active: true, usage: "45K calls/mo", status: "Healthy" },
          { name: "Stripe Subscriptions", active: true, usage: "1.2K calls/mo", status: "Healthy" },
          { name: "AWS S3 Loader", active: false, usage: "0 calls/mo", status: "Disabled" },
          { name: "Slack Webhooks", active: true, usage: "12K calls/mo", status: "Healthy" },
          { name: "Jira Integration", active: true, usage: "8K calls/mo", status: "Degraded" },
          { name: "Custom ERP Bridge", active: false, usage: "0 calls/mo", status: "Disabled" },
        ].map((mcp, i) => (
          <div key={i} className="p-5 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col gap-4 group hover:border-blue-500/30 transition-colors">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <button className={`p-1.5 rounded-md transition-colors ${mcp.active ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-foreground/10 text-foreground/40 hover:bg-foreground/20'}`}>
                <Power className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{mcp.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${mcp.status === 'Healthy' ? 'bg-emerald-500' : mcp.status === 'Disabled' ? 'bg-foreground/20' : 'bg-amber-500'}`}></span>
                <span className="text-xs text-foreground/50">{mcp.status}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-foreground/10 flex justify-between items-center">
              <span className="text-sm font-medium text-foreground/70">{mcp.usage}</span>
              <button className="text-xs text-blue-500 font-medium hover:underline">Configure</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
