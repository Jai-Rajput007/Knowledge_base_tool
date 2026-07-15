"use client";

import React from "react";
import { motion } from "framer-motion";
import { FiBookOpen, FiCode, FiTerminal } from "react-icons/fi";

export const DocumentationFeature = () => {
  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Documentation</h2>
          <p className="text-muted-foreground mt-2">
            Learn how to use the G1 Robot Platform and configure your systems.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
            <FiTerminal size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Learn the basics of the G1 dashboard, connecting your robot, and navigating the interface.
          </p>
          <a href="#" className="text-sm text-primary hover:underline font-medium">Read guide &rarr;</a>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="h-12 w-12 rounded-lg bg-accent-purple/10 flex items-center justify-center mb-4 text-accent-purple">
            <FiCode size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-2">API Reference</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comprehensive guide to the REST APIs for custom integrations and external control.
          </p>
          <a href="#" className="text-sm text-primary hover:underline font-medium">View reference &rarr;</a>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="h-12 w-12 rounded-lg bg-accent-cyan/10 flex items-center justify-center mb-4 text-accent-cyan">
            <FiBookOpen size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-2">Architecture</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Deep dive into the dual-node architecture, Edge AI processing, and DDS protocols.
          </p>
          <a href="#" className="text-sm text-primary hover:underline font-medium">Explore architecture &rarr;</a>
        </motion.div>
      </div>

      <div className="mt-8 rounded-xl bg-accent p-6 border border-border">
        <h3 className="text-lg font-semibold mb-2">Need Help?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If you can't find what you're looking for in the documentation, our support team is ready to help.
        </p>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity">
          Contact Support
        </button>
      </div>
    </div>
  );
};
