"use client";

import { useState, useEffect } from "react";
import { Check, X, ShieldAlert, Lock, Unlock } from "lucide-react";

export function McpConfigTab({ tenantId }: { tenantId: string }) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();
  }, [tenantId]);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/mcp`);
      const data = await res.json();
      setIntegrations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (mcpId: string, currentUnlocked: boolean, name: string) => {
    if (!currentUnlocked) {
      const confirm = window.confirm(`Are you sure you want to unlock ${name}? This may incur additional charges on your provider account.`);
      if (!confirm) return;
    }

    setToggling(mcpId);
    try {
      await fetch(`/api/tenants/${tenantId}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mcpId,
          isUnlocked: !currentUnlocked,
        }),
      });
      await fetchIntegrations();
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-muted rounded w-1/3"></div>
      <div className="h-32 bg-muted rounded w-full"></div>
    </div>;
  }

  // Filter only PRO integrations, as BASIC are permanently unlocked.
  const proIntegrations = integrations.filter(i => i.tier === "PRO");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Pro Integrations Access Control
          </h3>
          <p className="text-xs text-amber-400/80 mt-1">
            Unlocking an integration allows the tenant to configure and use it. This utilizes your master provider account (e.g. Composio).
          </p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.02] border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-medium text-white/50 uppercase tracking-widest text-xs">Integration</th>
              <th className="px-6 py-4 font-medium text-white/50 uppercase tracking-widest text-xs">Provider</th>
              <th className="px-6 py-4 font-medium text-white/50 uppercase tracking-widest text-xs text-center">Status</th>
              <th className="px-6 py-4 font-medium text-white/50 uppercase tracking-widest text-xs text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {proIntegrations.map((integration) => (
              <tr key={integration.id} className="hover:bg-white/[0.04] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white/90">{integration.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-white/60 font-mono text-xs uppercase tracking-widest">{integration.provider}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  {integration.isUnlocked ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider">
                      <Unlock className="w-3 h-3" /> Unlocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold uppercase tracking-wider">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    disabled={toggling === integration.id}
                    onClick={() => handleToggle(integration.id, integration.isUnlocked, integration.name)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${
                      integration.isUnlocked 
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white" 
                        : "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500 hover:text-white"
                    } disabled:opacity-50`}
                  >
                    {toggling === integration.id ? (
                      <span className="animate-pulse">Updating...</span>
                    ) : integration.isUnlocked ? (
                      <>Revoke Access <X className="w-3 h-3" /></>
                    ) : (
                      <>Grant Access <Check className="w-3 h-3" /></>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {proIntegrations.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-white/40 text-xs uppercase tracking-widest">
                  No Pro Integrations Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
