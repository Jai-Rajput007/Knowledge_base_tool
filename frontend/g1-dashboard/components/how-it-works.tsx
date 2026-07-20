"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, BrainCircuit, Smile, Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "wake-word",
    title: "Custom Wake Word",
    description:
      "Every interaction starts with your voice. VEDA listens for your brand-specific wake word — not a generic trigger — activating its full audio pipeline with advanced noise-cancellation the moment it hears you.",
    tagline: "Triggered by your brand's voice.",
    icon: Mic,
    image: "/step-1.png",
  },
  {
    id: "synthesis",
    title: "Synthesis",
    description:
      "In milliseconds, VEDA simultaneously pulls live context from your on-premise Knowledge Hub and calls the right MCP integrations — whether that's your calendar, CRM, or ticketing system — fusing everything into one accurate, real-time response.",
    tagline: "Knowledge meets live data.",
    icon: BrainCircuit,
    image: "/step-2.png",
  },
  {
    id: "persona",
    title: "Adapts Persona",
    description:
      "The fused data is shaped by your robot's assigned Persona Engine. Tone, language, formality, even how it handles silence — every word is filtered through the character you defined, so the robot always feels intentional and on-brand.",
    tagline: "Personality-filtered, always on-brand.",
    icon: Smile,
    image: "/step-3.png",
  },
  {
    id: "action",
    title: "Speech & Action",
    description:
      "The final response is delivered as natural speech, perfectly synchronized with a physical gesture sequence. A wave, a bow, a point — VEDA's body and voice move as one, creating an interaction that feels genuinely human.",
    tagline: "Words and body, perfectly in sync.",
    icon: Activity,
    image: "/step-4.png",
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="w-full py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
            How it Works
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            From the moment you speak to the final physical action, here is exactly how VEDA processes every interaction in milliseconds.
          </p>
        </div>

        {/* Top Area: Dynamic Image (Left) + Dynamic Text (Right) */}
        <div className="flex flex-col lg:flex-row gap-12 items-center mb-20 min-h-[380px]">

          {/* Left: Dynamic Image */}
          <div className="w-full lg:w-1/2 aspect-video lg:aspect-[16/10] relative rounded-2xl overflow-hidden border border-border bg-card/50 shadow-2xl shrink-0">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeStep}
                src={steps[activeStep].image}
                alt={steps[activeStep].title}
                initial={{ opacity: 0, scale: 1.05, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.97, filter: "blur(6px)" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
          </div>

          {/* Right: Dynamic Text */}
          <div className="w-full lg:w-1/2 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="max-w-lg"
              >
                {/* Icon bubble */}
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
                  {React.createElement(steps[activeStep].icon, { size: 28 })}
                </div>

                {/* Tagline */}
                <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">
                  {steps[activeStep].tagline}
                </p>

                {/* Title */}
                <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                  {steps[activeStep].title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                  {steps[activeStep].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom: Horizontal Stepper with lit-up connecting arrows */}
        <div className="flex items-center justify-center gap-0 w-full overflow-x-auto pt-6 pb-2">
          {steps.map((step, index) => {
            const isActive = activeStep === index;
            const isPast = index < activeStep;
            const Icon = step.icon;

            return (
              <React.Fragment key={step.id}>
                {/* Step Button */}
                <button
                  onMouseEnter={() => setActiveStep(index)}
                  className={cn(
                    "flex items-center justify-center px-8 py-3 rounded-xl transition-all duration-300 border shrink-0 font-bold text-sm",
                    isActive
                      ? "bg-card border-primary/40 shadow-[0_4px_24px_-4px_rgba(29,161,242,0.2)] scale-[1.06] text-primary z-10"
                      : isPast
                      ? "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-card/40"
                      : "bg-transparent border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-card/40"
                  )}
                >
                  Step {index + 1}
                </button>

                {/* Connector arrow between steps */}
                {index !== steps.length - 1 && (
                  <div className="flex items-center shrink-0 mx-1">
                    {/* Line segment */}
                    <motion.div
                      className="h-px w-10 transition-all duration-500"
                      style={{
                        background: index < activeStep
                          ? "var(--primary)"
                          : "var(--border)",
                      }}
                    />
                    {/* Arrow chevron */}
                    <ChevronRight
                      size={16}
                      className={cn(
                        "transition-colors duration-500 -ml-1",
                        index < activeStep ? "text-primary" : "text-border"
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
