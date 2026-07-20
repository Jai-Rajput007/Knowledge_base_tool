"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Network, Database, ShieldCheck, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const securityCards = [
  {
    title: "Completely local",
    description: "Run everything on your own hardware. No cloud dependencies, no external APIs, complete operational sovereignty.",
    icon: Server,
  },
  {
    title: "Within private network",
    description: "VEDA operates entirely within your private network (VPC/LAN), ensuring zero exposure to the public internet.",
    icon: Network,
  },
  {
    title: "Data stays on-premise",
    description: "Your knowledge base, documents, and chat logs never leave your physical premises. 100% data residency guaranteed.",
    icon: Database,
  },
  {
    title: "Granular RBAC",
    description: "Enterprise-grade Role-Based Access Control. Define strict permissions for owners, admins, and operators across your fleet.",
    icon: ShieldCheck,
  },
  {
    title: "Secure protocols",
    description: "End-to-end encrypted communication channels and strict PASETO session authentication. Built to withstand modern threats.",
    icon: Lock,
  },
];

export function SecurityFeatures() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => {
    if (currentIndex < securityCards.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  const prev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  return (
    <section className="w-full py-24 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header and Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h2 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight">
              How we are <span className="text-gray-500">secure.</span>
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="w-14 h-14 flex items-center justify-center bg-foreground text-background disabled:opacity-20 transition-opacity hover:opacity-80"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={next}
              disabled={currentIndex === securityCards.length - 1}
              className="w-14 h-14 flex items-center justify-center bg-foreground text-background disabled:opacity-20 transition-opacity hover:opacity-80"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Carousel / Stacked Cards */}
        <div className="flex w-full">
          {securityCards.map((card, i) => {
            const isPast = i < currentIndex;
            const isOdd = i % 2 === 0; // Alternates theme

            return (
              <motion.div
                key={i}
                layout
                initial={false}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "relative h-[280px] md:h-[340px] shrink-0 overflow-hidden cursor-pointer",
                  // Dynamic width: thin strip if past, full width if active/future
                  isPast ? "w-4 md:w-10 mr-0" : "w-[85vw] md:w-[600px] lg:w-[680px] mr-4 md:mr-8",
                  // Alternate themes (softer off-black and off-white)
                  isOdd 
                    ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-200 dark:text-zinc-900" 
                    : "bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 border-y border-r border-border"
                )}
                transition={{ type: "spring", bounce: 0, duration: 0.7 }}
              >
                <AnimatePresence mode="popLayout">
                  {!isPast && (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 w-[85vw] md:w-[600px] lg:w-[680px] p-8 md:p-12 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <h3 className={cn(
                          "text-3xl md:text-4xl font-bold leading-tight",
                          isOdd ? "text-zinc-50 dark:text-zinc-900" : "text-zinc-900 dark:text-zinc-100"
                        )}>
                          {card.title}
                        </h3>
                        <card.icon 
                          size={56} 
                          strokeWidth={1.5}
                          className={cn(
                            "shrink-0",
                            isOdd ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-400 dark:text-zinc-500"
                          )} 
                        />
                      </div>
                      <p className={cn(
                        "text-lg md:text-xl leading-relaxed",
                        isOdd ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-600 dark:text-zinc-400"
                      )}>
                        {card.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
