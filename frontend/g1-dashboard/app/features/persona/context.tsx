"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface PersonaContextType {
  personas: any[];
  loading: boolean;
  source: "robot" | "db" | null;
  availableWakewords: { filename: string; name: string }[];
  fetchPersonas: () => Promise<void>;
  
  // Cross-module dialog state
  roleBuilderPersona: any | null;
  isRoleBuilderOpen: boolean;
  openRoleBuilder: (persona?: any) => void;
  closeRoleBuilder: () => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"robot" | "db" | null>(null);
  const [availableWakewords, setAvailableWakewords] = useState<{filename: string; name: string}[]>([]);

  // Dialog state
  const [roleBuilderPersona, setRoleBuilderPersona] = useState<any | null>(null);
  const [isRoleBuilderOpen, setIsRoleBuilderOpen] = useState(false);

  const fetchPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPersonas();
      setPersonas(Array.isArray(res.data) ? res.data : []);
      
      api.getActivePersona()
        .then(r => setSource((r.data as any)?._source || "db"))
        .catch(() => setSource("db"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchPersonas(); 
    api.getWakewords()
      .then(res => {
        if ((res.data as any)?.models) setAvailableWakewords((res.data as any).models);
      })
      .catch(err => console.error("Failed to load wakewords:", err));
  }, [fetchPersonas]);

  const openRoleBuilder = (persona: any = null) => {
    setRoleBuilderPersona(persona);
    setIsRoleBuilderOpen(true);
  };

  const closeRoleBuilder = () => {
    setIsRoleBuilderOpen(false);
    setRoleBuilderPersona(null);
  };

  return (
    <PersonaContext.Provider value={{
      personas,
      loading,
      source,
      availableWakewords,
      fetchPersonas,
      roleBuilderPersona,
      isRoleBuilderOpen,
      openRoleBuilder,
      closeRoleBuilder
    }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersonaContext() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error("usePersonaContext must be used within a PersonaProvider");
  }
  return context;
}
