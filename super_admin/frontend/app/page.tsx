"use client";

import { Users, Server, Activity, ArrowUpRight, ShieldCheck, Database, FileText } from "lucide-react";
import Link from "next/link";

export default function SuperAdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Overview</h1>
          <p className="text-foreground/50 mt-1">System informatics and health monitoring.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-foreground/5 border border-foreground/10 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-24 h-24 text-purple-500 -mr-6 -mt-6" />
          </div>
          <div className="flex items-center gap-3 text-purple-500 relative z-10">
            <Users className="w-5 h-5" />
            <h3 className="font-semibold uppercase tracking-widest text-xs">Total Tenants</h3>
          </div>
          <p className="text-4xl font-bold text-foreground mt-2 relative z-10">24</p>
          <p className="text-xs text-emerald-500 font-medium relative z-10 flex items-center mt-2">
            <ArrowUpRight className="w-3 h-3 mr-1" /> +3 this week
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-foreground/5 border border-foreground/10 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="w-24 h-24 text-emerald-500 -mr-6 -mt-6" />
          </div>
          <div className="flex items-center gap-3 text-emerald-500 relative z-10">
            <Activity className="w-5 h-5" />
            <h3 className="font-semibold uppercase tracking-widest text-xs">Active Robots</h3>
          </div>
          <p className="text-4xl font-bold text-foreground mt-2 relative z-10">1,205</p>
          <p className="text-xs text-emerald-500 font-medium relative z-10 flex items-center mt-2">
            <ArrowUpRight className="w-3 h-3 mr-1" /> +124 this week
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-foreground/5 border border-foreground/10 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldCheck className="w-24 h-24 text-blue-500 -mr-6 -mt-6" />
          </div>
          <div className="flex items-center gap-3 text-blue-500 relative z-10">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-semibold uppercase tracking-widest text-xs">Integrations</h3>
          </div>
          <p className="text-4xl font-bold text-foreground mt-2 relative z-10">87</p>
          <p className="text-xs text-foreground/50 font-medium relative z-10 flex items-center mt-2">
            Active MCP subscriptions
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-foreground/5 border border-foreground/10 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Server className="w-24 h-24 text-rose-500 -mr-6 -mt-6" />
          </div>
          <div className="flex items-center gap-3 text-rose-500 relative z-10">
            <Server className="w-5 h-5" />
            <h3 className="font-semibold uppercase tracking-widest text-xs">System Health</h3>
          </div>
          <p className="text-4xl font-bold text-foreground mt-2 relative z-10">99.9%</p>
          <p className="text-xs text-foreground/50 font-medium relative z-10 flex items-center mt-2">
            All systems operational
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-foreground/5 border border-foreground/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/tenants" className="p-4 rounded-xl bg-background border border-foreground/10 hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-all flex flex-col gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Manage Tenants</h3>
                <p className="text-xs text-foreground/50">Create or remove workspaces</p>
              </div>
            </Link>
            
            <Link href="/permissions" className="p-4 rounded-xl bg-background border border-foreground/10 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all flex flex-col gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Permissions</h3>
                <p className="text-xs text-foreground/50">Configure tenant features</p>
              </div>
            </Link>

            <Link href="/integrations" className="p-4 rounded-xl bg-background border border-foreground/10 hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all flex flex-col gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Integrations</h3>
                <p className="text-xs text-foreground/50">Manage MCP subscriptions</p>
              </div>
            </Link>

            <Link href="/audit-logs" className="p-4 rounded-xl bg-background border border-foreground/10 hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)] transition-all flex flex-col gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Audit Logs</h3>
                <p className="text-xs text-foreground/50">View system activity logs</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-foreground/5 border border-foreground/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
            <Link href="/audit-logs" className="text-sm text-purple-500 hover:underline">View all</Link>
          </div>
          <div className="space-y-4">
            {[
              { id: 1, action: "New tenant created", target: "Acme Corp", time: "10 minutes ago", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
              { id: 2, action: "Feature flag enabled", target: "Voice synthesis (Stark Ind)", time: "1 hour ago", icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { id: 3, action: "MCP Integration updated", target: "GitHub Loader", time: "3 hours ago", icon: Database, color: "text-blue-500", bg: "bg-blue-500/10" },
              { id: 4, action: "System backup completed", target: "Cluster A", time: "5 hours ago", icon: Server, color: "text-rose-500", bg: "bg-rose-500/10" },
            ].map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-background transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.bg} ${log.color}`}>
                  <log.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{log.action}</p>
                  <p className="text-xs text-foreground/50">{log.target} • {log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Spacer to allow scrolling to test navbar */}
      <div className="h-[500px]"></div>
    </div>
  );
}
