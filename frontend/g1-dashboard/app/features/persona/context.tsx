"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

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
      const res = await fetch("/api/personas");
      const data = await res.json();
      setPersonas(Array.isArray(data) ? data : []);
      
      fetch("/api/persona")
        .then(r => r.json())
        .then(d => setSource(d._source || "db"))
        .catch(() => setSource("db"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchPersonas(); 
    fetch("/api/wakewords")
      .then(res => res.json())
      .then(data => {
        if (data.models) setAvailableWakewords(data.models);
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
