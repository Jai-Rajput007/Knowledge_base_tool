"use client";

import React from "react";
import { motion } from "framer-motion";
import { FiCpu, FiGlobe, FiShield } from "react-icons/fi";

export const AboutFeature = () => {
  return (
    <div className="flex-1 space-y-8 p-8 overflow-y-auto">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-bold tracking-tight">About G1 Universe</h2>
        <p className="text-lg text-muted-foreground mt-4 leading-relaxed">
          The G1 Universe is the premier management and orchestration platform for the Unitree G1 Humanoid Robot. 
          Built with an advanced edge-AI architecture on the NVIDIA AGX Orin, it bridges the gap between hardware execution and high-level cognitive planning.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mt-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border"
        >
          <div className="h-16 w-16 rounded-full bg-accent-blue/10 flex items-center justify-center mb-6 text-accent-blue">
            <FiCpu size={32} />
          </div>
          <h3 className="text-xl font-bold mb-3">Edge Intelligence</h3>
          <p className="text-muted-foreground">
            Fully localized RAG and LLM processing ensures zero latency and total data privacy during robotic operations.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border"
        >
          <div className="h-16 w-16 rounded-full bg-accent-purple/10 flex items-center justify-center mb-6 text-accent-purple">
            <FiShield size={32} />
          </div>
          <h3 className="text-xl font-bold mb-3">Enterprise Security</h3>
          <p className="text-muted-foreground">
            Multi-tenant isolation using PASETO v4 encryption guarantees that your proprietary data remains yours.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border"
        >
          <div className="h-16 w-16 rounded-full bg-accent-cyan/10 flex items-center justify-center mb-6 text-accent-cyan">
            <FiGlobe size={32} />
          </div>
          <h3 className="text-xl font-bold mb-3">Universal Control</h3>
          <p className="text-muted-foreground">
            Manage your entire fleet of G1 units from anywhere in the world with real-time DDS telemetry bridging.
          </p>
        </motion.div>
      </div>

      <div className="mt-12 pt-8 border-t border-border">
        <p className="text-sm text-muted-foreground text-center">
          Version 2.4.0 (Build 8912) &bull; &copy; {new Date().getFullYear()} G1 Intelligence Corp.
        </p>
      </div>
    </div>
  );
};
