"use client";

import React, { useState } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiPlus, FiTrash2, FiMaximize, FiUpload } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

export function ConfigurationGesturesModule() {
  const [gestures, setGestures] = useState([
    { id: 1, name: "Nod", trigger: "Agreement", type: "system" },
    { id: 2, name: "Shake Head", trigger: "Disagreement", type: "system" },
  ]);

  const handleDelete = (id: number) => {
    setGestures(gestures.filter(g => g.id !== id));
  };

  return (
    <FeatureGate featureKey="configurationGestures">
      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-primary font-mono text-sm">[CFG]</span>
          <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">Configuration Gestures</h2>
        </div>

        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity rounded-lg shadow-lg">
            <FiPlus /> Add Gesture
          </button>
          <button className="flex items-center gap-2 px-6 py-3 border border-border text-foreground font-semibold uppercase tracking-wider text-sm hover:bg-card/50 transition-colors rounded-lg">
            <FiUpload /> Upload Library
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          <AnimatePresence>
            {gestures.map((gesture) => (
              <motion.div
                key={gesture.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 border border-border bg-card/30 rounded-xl hover:bg-card/60 transition-colors group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{gesture.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground uppercase">{gesture.trigger}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded text-primary">
                    <FiMaximize />
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-6">
                  <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${
                    gesture.type === 'system' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/20 text-primary'
                  }`}>
                    {gesture.type}
                  </span>
                  
                  <button 
                    onClick={() => handleDelete(gesture.id)}
                    className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </FeatureGate>
  );
}
