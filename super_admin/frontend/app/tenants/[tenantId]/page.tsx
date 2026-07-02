import { notFound } from "next/navigation";
import { McpConfigTab } from "@/components/super-admin/McpConfigTab";
import { FeaturesConfigTab } from "@/components/super-admin/FeaturesConfigTab";
import { getIcon } from "@/components/icons";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function SuperAdminTenantPage({
  params,
}: {
  params: { tenantId: string };
}) {
  let tenant = null;
  try {
    const res = await fetch(`/api/tenants/${params.tenantId}`);
    if (res.ok) {
      tenant = await res.json();
    }
  } catch (err) {
    console.error(err);
  }

  if (!tenant) {
    notFound();
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div>
        <Link href="/super-admin" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to System Core
        </Link>
        <h1 className="text-4xl font-bold text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/30">
            {getIcon('tenants', 'w-6 h-6')}
          </div>
          {tenant.name}
        </h1>
        <p className="text-xs font-mono text-white/40 mt-3 uppercase tracking-widest pl-16">
          Entity ID // {tenant.id}
        </p>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 sticky top-24">
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              Overview
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              Users & Roles
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              Robots Fleet
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold bg-white/10 text-white border border-white/10 shadow-lg transition-colors flex items-center justify-between">
              Configuration
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            </button>
            <button className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors">
              Billing & Limits
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Features Config Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="mb-8 border-b border-white/10 pb-4 relative">
              <h2 className="text-2xl font-bold text-white tracking-tight">Platform Capabilities</h2>
              <p className="text-sm text-white/60 mt-1">Enable or disable core system modules for this tenant entity.</p>
            </div>
            <FeaturesConfigTab tenantId={tenant.id} />
          </div>

          {/* MCP Config Section */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="mb-8 border-b border-white/10 pb-4 relative">
              <h2 className="text-2xl font-bold text-white tracking-tight">MCP Integration Routing</h2>
              <p className="text-sm text-white/60 mt-1">Manage which external provider tools this tenant is allowed to configure.</p>
            </div>
            <McpConfigTab tenantId={tenant.id} />
          </div>
          
        </div>
      </div>
    </div>
  );
}
