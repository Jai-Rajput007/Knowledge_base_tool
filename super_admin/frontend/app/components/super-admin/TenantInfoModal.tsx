"use client";

import { useState } from "react";
import { X, Check, Settings, Sparkles } from "lucide-react";
import { FeaturesConfigTab } from "./FeaturesConfigTab";

export function TenantInfoModal({ tenant, onClose, onSuccess }: { tenant: any, onClose: () => void, onSuccess: () => void }) {
  const [activeTab, setActiveTab] = useState<"info" | "features">("info");
  const [name, setName] = useState(tenant.name || "");
  const [host, setHost] = useState(tenant.host || "");
  const [companyDescription, setCompanyDescription] = useState(tenant.companyDescription || "");
  const [companyType, setCompanyType] = useState(tenant.companyType || "");
  const [companyLogo, setCompanyLogo] = useState(tenant.companyLogo || "");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          host,
          companyDescription,
          companyType,
          companyLogo,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(true);
        onSuccess();
        setTimeout(() => {
          setSuccess(false);
        }, 2000);
      } else {
        setError(data.error || "Failed to update tenant");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update tenant due to a network error");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "info" as const, label: "Tenant Info", icon: Settings },
    { id: "features" as const, label: "Features", icon: Sparkles },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-background border border-foreground/10 w-full max-w-2xl shadow-2xl rounded-2xl flex flex-col relative my-8">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 blur-2xl pointer-events-none rounded-t-2xl" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-foreground/10 relative z-10">
          <div>
            <h3 className="text-lg font-bold text-foreground tracking-tight">
              {tenant.name}
            </h3>
            <p className="text-xs text-foreground/40 font-mono mt-0.5">{tenant.id}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-foreground/10 relative z-10 px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-purple-500 text-foreground"
                  : "border-transparent text-foreground/50 hover:text-foreground/80"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div className="relative z-10 overflow-y-auto max-h-[65vh]">
          {activeTab === "info" && (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 text-sm flex items-center gap-2 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Check className="w-4 h-4" /> Updated successfully!
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Tenant / Company Name</label>
                <input 
                  type="text"
                  className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-blue-500 focus:outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Host / Admin Name</label>
                <input 
                  type="text"
                  className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-blue-500 focus:outline-none transition-all"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Company Type</label>
                <input 
                  type="text"
                  className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-blue-500 focus:outline-none transition-all"
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Company Description</label>
                <textarea 
                  rows={3}
                  className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-blue-500 focus:outline-none transition-all"
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Logo URL</label>
                <input 
                  type="url"
                  className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-blue-500 focus:outline-none transition-all"
                  value={companyLogo}
                  onChange={(e) => setCompanyLogo(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-foreground/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === "features" && (
            <div className="p-6">
              <FeaturesConfigTab tenantId={tenant.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
