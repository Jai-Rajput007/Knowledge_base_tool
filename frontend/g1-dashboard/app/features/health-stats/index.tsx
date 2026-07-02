"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiBatteryCharging, FiCpu, FiWifi, FiThermometer, FiActivity } from "react-icons/fi";
import { motion } from "framer-motion";

export function HealthStatsModule() {
  const stats = [
    { label: "Core Temp", value: "42°C", status: "normal", icon: FiThermometer, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Battery", value: "87%", status: "charging", icon: FiBatteryCharging, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "CPU Load", value: "14%", status: "normal", icon: FiCpu, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Network", value: "42ms", status: "stable", icon: FiWifi, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <FeatureGate featureKey="healthStats">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 border border-border bg-card/30 rounded-xl relative overflow-hidden group hover:bg-card/60 transition-colors"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${stat.bg.replace('/10', '')}`} />
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-background px-2 py-1 rounded border border-border">
                  {stat.status}
                </span>
              </div>
              
              <div className="relative z-10">
                <h3 className="text-3xl font-bold tracking-tighter mb-1">{stat.value}</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-8 border border-border bg-card/20 rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <FiActivity className="text-primary" size={20} />
            <h3 className="font-bold text-lg uppercase tracking-wide">System Diagnostics</h3>
          </div>
          
          <div className="h-48 flex items-center justify-center border border-dashed border-border/50 rounded-lg bg-background/50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-end gap-1 h-12 opacity-50">
                {[40, 70, 45, 90, 65, 30, 80, 50, 60, 40, 75, 55, 85].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [`${h}%`, `${Math.max(20, h - 20)}%`, `${h}%`] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                    className="w-2 bg-primary/40 rounded-t-sm"
                  />
                ))}
              </div>
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Live Telemetry Active</span>
            </div>
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
