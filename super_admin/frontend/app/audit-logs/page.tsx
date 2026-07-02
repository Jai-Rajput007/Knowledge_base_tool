"use client";

import { FileText, Search, Filter, Download } from "lucide-react";

export default function AuditLogsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Audit Logs</h1>
          <p className="text-foreground/50 mt-1">Comprehensive system activity and security tracking.</p>
        </div>
        <button className="px-4 py-2 bg-background border border-foreground/20 hover:bg-foreground/5 text-foreground rounded-lg font-medium transition-all flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-foreground/5 border border-foreground/10 rounded-2xl overflow-hidden shadow-lg shadow-black/5">
        <div className="p-4 border-b border-foreground/10 bg-foreground/5 flex gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input 
              type="text" 
              placeholder="Search event ID, tenant, or action..." 
              className="w-full pl-9 pr-4 py-2 bg-background border border-foreground/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>
          <button className="px-4 py-2 bg-background border border-foreground/10 rounded-lg text-sm font-medium hover:bg-foreground/5 transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/5 text-foreground/60 font-medium">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">Actor</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Target / Tenant</th>
                <th className="px-6 py-3 font-medium">IP Address</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {[
                { time: "2026-06-30 18:45:12", actor: "Super Admin", action: "UPDATE_FEATURE_FLAG", target: "Acme Corp", ip: "192.168.1.15", status: "Success", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { time: "2026-06-30 18:32:05", actor: "System Agent", action: "EXECUTE_MCP", target: "GitHub Loader", ip: "10.0.0.42", status: "Success", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { time: "2026-06-30 18:15:22", actor: "Super Admin", action: "DELETE_TENANT", target: "Test Tenant X", ip: "192.168.1.15", status: "Success", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { time: "2026-06-30 17:50:01", actor: "Unknown", action: "AUTH_FAILED", target: "Super Admin Portal", ip: "203.0.113.45", status: "Failed", color: "text-rose-500", bg: "bg-rose-500/10" },
                { time: "2026-06-30 17:10:44", actor: "Super Admin", action: "CREATE_TENANT", target: "Stark Industries", ip: "192.168.1.15", status: "Success", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { time: "2026-06-30 16:05:19", actor: "System Agent", action: "SYNC_BILLING", target: "Stripe Subscriptions", ip: "10.0.0.42", status: "Warning", color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map((log, i) => (
                <tr key={i} className="hover:bg-foreground/5 transition-colors">
                  <td className="px-6 py-4 text-foreground/70 whitespace-nowrap">{log.time}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{log.actor}</td>
                  <td className="px-6 py-4 text-foreground/80 font-mono text-xs">{log.action}</td>
                  <td className="px-6 py-4 text-foreground/80">{log.target}</td>
                  <td className="px-6 py-4 text-foreground/50 font-mono text-xs">{log.ip}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${log.bg} ${log.color}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-foreground/10 flex items-center justify-between text-sm text-foreground/50">
          <span>Showing 1 to 6 of 14,203 entries</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-foreground/10 rounded hover:bg-foreground/5" disabled>Previous</button>
            <button className="px-3 py-1 border border-foreground/10 rounded hover:bg-foreground/5">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
