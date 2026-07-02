"use client";

import React, { useState } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiDownload, FiFilter, FiSearch, FiShield } from "react-icons/fi";
import { motion } from "framer-motion";

export function AuditingModule() {
  const [logs] = useState([
    { id: 1, action: "User Login", user: "Admin", ip: "192.168.1.10", time: "2 mins ago", status: "success" },
    { id: 2, action: "Updated Persona", user: "Admin", ip: "192.168.1.10", time: "15 mins ago", status: "success" },
    { id: 3, action: "Failed Authentication", user: "Unknown", ip: "203.0.113.45", time: "1 hour ago", status: "failed" },
    { id: 4, action: "Feature Toggled: Voice", user: "Super Admin", ip: "10.0.0.5", time: "3 hours ago", status: "success" },
    { id: 5, action: "API Key Generated", user: "Admin", ip: "192.168.1.10", time: "1 day ago", status: "success" },
  ]);

  return (
    <FeatureGate featureKey="auditing">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="relative w-full sm:w-96">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search audit logs..."
              className="w-full bg-card border border-border pl-12 pr-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:border-primary transition-colors rounded-lg shadow-sm"
            />
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-border text-foreground font-semibold uppercase tracking-wider text-sm hover:bg-card/50 transition-colors rounded-lg">
              <FiFilter /> Filter
            </button>
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground font-semibold uppercase tracking-wider text-sm hover:opacity-90 transition-opacity rounded-lg shadow-sm">
              <FiDownload /> Export
            </button>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card/30">
          <div className="grid grid-cols-5 gap-4 p-4 border-b border-border bg-muted/50 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <div className="col-span-2">Action</div>
            <div>User</div>
            <div>IP Address</div>
            <div className="text-right">Timestamp</div>
          </div>

          <div className="flex flex-col">
            {logs.map((log, i) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="grid grid-cols-5 gap-4 p-4 items-center border-b border-border/50 hover:bg-card/50 transition-colors last:border-0"
              >
                <div className="col-span-2 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-bold text-sm text-foreground">{log.action}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {log.user === "Super Admin" && <FiShield className="text-amber-500" size={12} />}
                  {log.user}
                </div>
                <div className="font-mono text-xs text-muted-foreground">{log.ip}</div>
                <div className="text-right font-mono text-xs text-muted-foreground">{log.time}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
