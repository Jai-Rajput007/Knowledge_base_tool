"use client";

import React, { useState } from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { FiShield, FiUserPlus, FiMoreVertical } from "react-icons/fi";
import { motion } from "framer-motion";

export function RbacModule() {
  const [users] = useState([
    { id: 1, name: "Alice Admin", email: "alice@example.com", role: "Super Admin", lastActive: "2 mins ago" },
    { id: 2, name: "Bob Editor", email: "bob@example.com", role: "Manager", lastActive: "1 hour ago" },
    { id: 3, name: "Charlie Viewer", email: "charlie@example.com", role: "Viewer", lastActive: "2 days ago" },
  ]);

  return (
    <FeatureGate featureKey="rbac">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold uppercase tracking-wide">Role-Based Access Control</h3>
            <p className="text-sm text-muted-foreground font-mono mt-1">Manage user permissions and security roles.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider rounded shadow hover:opacity-90">
            <FiUserPlus /> Invite User
          </button>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card/30">
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-border bg-muted/50 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <div className="col-span-2">User</div>
            <div>Role</div>
            <div className="text-right">Actions</div>
          </div>
          
          <div className="divide-y divide-border/50">
            {users.map((u) => (
              <motion.div key={u.id} className="grid grid-cols-4 gap-4 p-4 items-center hover:bg-card/50 transition-colors">
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{u.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-mono px-2 py-1 bg-secondary text-secondary-foreground rounded uppercase">
                    {u.role}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button className="p-2 text-muted-foreground hover:text-foreground">
                    <FiMoreVertical />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}
