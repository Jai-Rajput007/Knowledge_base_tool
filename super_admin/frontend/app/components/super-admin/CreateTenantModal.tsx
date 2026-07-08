"use client";

import { useState } from "react";
import { Plus, X, Copy, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export function CreateTenantModal({ onSuccess }: { onSuccess?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [host, setHost] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [companyLogo, setCompanyLogo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [successData, setSuccessData] = useState<{ email: string, password: string, tenantId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch(`/api/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          email,
          plan: "Starter",
          host,
          companyDescription,
          companyType,
          companyLogo
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccessData({
          email: data.user.email,
          password: data.password,
          tenantId: data.tenant.id
        });
        router.refresh(); 
      } else {
        setError(data.error || "Failed to create tenant");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create tenant due to a network error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!successData) return;
    const text = `Dashboard Access Credentials:\nURL: https://${window.location.hostname}/sign-in\nEmail: ${successData.email}\nPassword: ${successData.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (successData && onSuccess) {
      onSuccess();
    }
    setTimeout(() => {
      setName("");
      setEmail("");
      setHost("");
      setCompanyDescription("");
      setCompanyType("");
      setCompanyLogo("");
      setError("");
      setSuccessData(null);
    }, 300);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors font-medium text-sm shadow-[0_0_15px_rgba(147,51,234,0.3)]"
      >
        <Plus className="w-4 h-4" /> New Tenant
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-background border border-foreground/10 w-full max-w-md shadow-2xl rounded-2xl flex flex-col relative my-8">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-2xl pointer-events-none rounded-t-2xl" />

            <div className="flex items-center justify-between p-5 border-b border-foreground/10 relative z-10">
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                {successData ? "Tenant Created Successfully" : "Create New Tenant"}
              </h3>
              <button 
                onClick={handleClose}
                className="p-1.5 hover:bg-foreground/10 text-foreground/50 hover:text-foreground rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {successData ? (
              <div className="p-6 space-y-6 relative z-10">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm">
                  The tenant was created successfully. Please save these credentials and share them with the client.
                </div>
                
                <div className="space-y-3 font-mono text-sm bg-foreground/5 p-4 rounded-lg border border-foreground/10">
                  <div>
                    <span className="text-foreground/50">Email:</span> <br/>
                    <span className="text-foreground font-bold">{successData.email}</span>
                  </div>
                  <div>
                    <span className="text-foreground/50">Password:</span> <br/>
                    <span className="text-foreground font-bold">{successData.password}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-foreground/10">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 flex items-center gap-2 rounded-lg text-sm font-medium text-foreground bg-foreground/10 hover:bg-foreground/20 transition-colors"
                  >
                    {copied ? <><Check className="w-4 h-4 text-emerald-500"/> Copied!</> : <><Copy className="w-4 h-4"/> Copy Credentials</>}
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5 relative z-10 overflow-y-auto max-h-[70vh]">
                {error && (
                  <div className="p-3 text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Tenant / Company Name</label>
                  <input 
                    type="text"
                    className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-purple-500 focus:outline-none transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Admin Email</label>
                  <input 
                    type="email"
                    className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-purple-500 focus:outline-none transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Host / Admin Name</label>
                  <input 
                    type="text"
                    placeholder="John Doe"
                    className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-purple-500 focus:outline-none transition-all"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Company Type</label>
                  <input 
                    type="text"
                    placeholder="e.g. Healthcare, Retail"
                    className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-purple-500 focus:outline-none transition-all"
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Company Description</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-purple-500 focus:outline-none transition-all"
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/70 uppercase tracking-widest">Logo URL (Optional)</label>
                  <input 
                    type="url"
                    placeholder="https://..."
                    className="w-full bg-background border border-foreground/10 px-3 py-2.5 text-sm text-foreground rounded-lg focus:border-purple-500 focus:outline-none transition-all"
                    value={companyLogo}
                    onChange={(e) => setCompanyLogo(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-foreground/10 sticky bottom-0 bg-background">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Tenant'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
