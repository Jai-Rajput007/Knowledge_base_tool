"use client";

import { useEffect, useState } from "react";
import { CreateTenantModal } from "@/components/super-admin/CreateTenantModal";
import { TenantInfoModal } from "@/components/super-admin/TenantInfoModal";
import { Users, Info, Trash2 } from "lucide-react";

export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  async function fetchTenants() {
    try {
      const res = await fetch(`/api/tenants`);
      if (res.ok) {
        const data = await res.json();
        setTenants(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTenants();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Tenants</h1>
          <p className="text-foreground/50 mt-1">Manage all client workspaces and their details.</p>
        </div>
        <CreateTenantModal onSuccess={fetchTenants} />
      </div>

      <div className="bg-foreground/5 border border-foreground/10 rounded-2xl overflow-hidden shadow-lg shadow-black/5">
        <div className="p-5 border-b border-foreground/10 bg-foreground/5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-foreground">All Tenants</h2>
          <span className="text-sm font-medium text-foreground/50">{tenants.length} Total</span>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-foreground/50">Loading tenants...</div>
        ) : tenants.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center text-foreground/30">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-lg text-foreground font-semibold mt-2">No tenants found</h3>
            <p className="text-sm text-foreground/50 max-w-sm">Create your first tenant to start managing workspaces and assigning features.</p>
          </div>
        ) : (
          <div className="divide-y divide-foreground/10">
            {tenants.map((tenant: any) => (
              <div key={tenant.id} className="p-5 flex items-center justify-between hover:bg-foreground/5 transition-colors group">
                <div className="flex flex-col gap-1">
                  <h3 className="text-foreground font-medium text-lg flex items-center gap-2">
                    {tenant.name}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-widest">Active</span>
                  </h3>
                  <p className="text-sm text-foreground/50">Host: <span className="text-foreground/80 font-medium">{tenant.host || 'N/A'}</span></p>
                </div>
                <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setSelectedTenant(tenant);
                      setIsInfoOpen(true);
                    }}
                    title="View Info"
                    className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors border border-blue-500/20 shadow-sm"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                  <button 
                    title="Delete Tenant"
                    onClick={async () => {
                      if(confirm('Are you sure you want to delete this tenant?')) {
                        await fetch(`/api/tenants/${tenant.id}`, { method: 'DELETE' });
                        fetchTenants();
                      }
                    }}
                    className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors border border-destructive/20 shadow-sm ml-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isInfoOpen && selectedTenant && (
        <TenantInfoModal 
          tenant={selectedTenant}
          onClose={() => setIsInfoOpen(false)}
          onSuccess={fetchTenants}
        />
      )}
    </div>
  );
}
