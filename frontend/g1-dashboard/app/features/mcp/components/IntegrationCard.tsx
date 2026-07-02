import React from "react";
import { Integration } from "../types";
import { FiDatabase, FiCloud, FiTool, FiCode, FiSettings, FiCheckCircle, FiXCircle } from "react-icons/fi";

interface IntegrationCardProps {
  integration: Integration;
  onToggle: (id: string, currentStatus: boolean) => void;
  onConfigure: (id: string) => void;
}

export function IntegrationCard({ integration, onToggle, onConfigure }: IntegrationCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'database': return <FiDatabase size={16} />;
      case 'cloud': return <FiCloud size={16} />;
      case 'utility': return <FiTool size={16} />;
      default: return <FiCode size={16} />;
    }
  };

  const getBrandIcon = (name: string) => {
    const brand = name.toLowerCase();
    if (brand.includes('google')) return <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs uppercase">G</div>;
    if (brand.includes('github')) return <div className="w-8 h-8 rounded-full bg-gray-500/10 text-gray-500 flex items-center justify-center font-bold text-xs uppercase">GH</div>;
    if (brand.includes('slack')) return <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs uppercase">S</div>;
    if (brand.includes('linear')) return <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs uppercase">L</div>;
    if (brand.includes('postgres')) return <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-bold text-xs uppercase">PG</div>;
    return <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">{name.charAt(0)}</div>;
  };

  return (
    <div className={`p-6 border rounded-xl transition-all ${integration.is_active ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/20'} flex flex-col justify-between`}>
      <div>
        <div className="flex justify-between items-start mb-4">
          {getBrandIcon(integration.name)}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground border border-border px-2 py-1 rounded flex items-center gap-1">
              {getCategoryIcon(integration.category)}
              {integration.category}
            </span>
          </div>
        </div>
        <h3 className="font-bold text-lg">{integration.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {integration.description || `Connect your agent to ${integration.name} for extended capabilities.`}
        </p>
      </div>
      
      <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
        <button 
          role="switch"
          onClick={() => onToggle(integration.id, integration.is_active)}
          className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors ${integration.is_active ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {integration.is_active ? <FiCheckCircle /> : <FiXCircle />}
          {integration.is_active ? 'Active' : 'Disabled'}
        </button>
        
        {integration.config_schema && (
          <button 
            title="Configure"
            onClick={() => onConfigure(integration.id)}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <FiSettings size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
