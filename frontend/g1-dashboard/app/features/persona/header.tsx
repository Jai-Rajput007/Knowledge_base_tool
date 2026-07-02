"use client";

import { FiRefreshCw } from "react-icons/fi";
import { usePersonaContext } from "./context";

export function PersonaHeader() {
  const { source, fetchPersonas, loading } = usePersonaContext();
  
  return (
    <div className="border-b border-border pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
            Persona Manager
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
            SYS.CONFIG // Configure system parameters and operational protocols
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPersonas}
            className="p-2 border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            title="Reload from robot"
            disabled={loading}
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${source === "robot" ? "bg-green-400 animate-pulse" : source === "db" ? "bg-yellow-400" : "bg-muted"}`} />
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {source === "robot" ? "Reading from: Robot (live)" : source === "db" ? "Reading from: Database (robot offline)" : "Connecting..."}
          </span>
        </div>
      </div>
    </div>
  );
}
