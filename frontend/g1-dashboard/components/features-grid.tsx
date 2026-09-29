"use client";

import React from 'react';
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogTitle,
  MorphingDialogSubtitle,
  MorphingDialogClose,
  MorphingDialogDescription,
  MorphingDialogImage,
  MorphingDialogContainer,
} from '@/components/motion-primitives/morphing-dialog';
import { PlusIcon } from 'lucide-react';

const featuresData = [
  {
    title: "Persona",
    subtitle: "Custom Robot Personalities",
    image: "/persona.webp",
    paragraphs: [
      "Define distinct behavioral personas for each robot in your fleet. A persona controls everything from the robot's tone of voice and conversation style to how it greets users, handles awkward pauses, and responds to unexpected questions.",
      "With VEDA's persona engine you can deploy the same hardware with entirely different personalities — a cheerful concierge for the hotel lobby, a focused safety assistant for the factory floor, and a playful companion for the children's ward — all managed from one dashboard.",
    ],
  },
  {
    title: "Integrations",
    subtitle: "Seamless API Connectivity",
    image: "/integrations.webp",
    paragraphs: [
      "Connect your robot fleet to essential external services without writing a single line of code. VEDA ships with pre-built adapters for Google Workspace (Calendar, Gmail, Drive, Docs), CRM platforms, ticketing systems, and custom REST/GraphQL APIs.",
      "Every integration runs through a secure MCP (Model Context Protocol) layer, meaning your robot can read a visitor's calendar, draft an email summary, or create a support ticket — all in real time during a conversation.",
    ],
  },
  {
    title: "Wake Word",
    subtitle: "Voice Activation Control",
    image: "/wakeword.webp",
    paragraphs: [
      "Set and manage fully custom wake words that activate your robot's listening pipeline. Instead of generic \"Hey Robot,\" deploy brand-specific triggers like \"Hey VEDA\" or \"Hello Nova\" that reinforce your identity.",
      "Fine-tune activation sensitivity, noise-gate thresholds, and cooldown timers to eliminate false positives in noisy environments like trade shows or retail floors while ensuring the robot never misses a genuine command.",
    ],
  },
  {
    title: "Knowledge Hub",
    subtitle: "Centralized Intelligence",
    image: "/knoweledge_hub.webp",
    paragraphs: [
      "Upload SOPs, product manuals, FAQs, and company policy documents into a centralized knowledge base that every robot in your fleet can query in real time. Documents are automatically chunked, embedded, and indexed for instant retrieval.",
      "The Knowledge Hub runs entirely on-premise with Ollama, meaning sensitive data never leaves your network. Version history, access logs, and per-document analytics let you track exactly which knowledge your robots rely on most.",
    ],
  },
  {
    title: "RBAC",
    subtitle: "Role-Based Access Control",
    image: "/rbac.webp",
    paragraphs: [
      "Enterprise-grade security built into every layer. Define granular roles — Owner, Admin, Operator, Viewer — and control exactly who can upload documents, modify robot personas, toggle integrations, or access conversation logs.",
      "RBAC policies propagate instantly across the entire fleet. Combined with PASETO session tokens and audit trails, you get full compliance-ready access management without slowing down your operations team.",
    ],
  },
  {
    title: "Multilingual",
    subtitle: "Global Language Support",
    image: "/multilingual.webp",
    paragraphs: [
      "Deploy robots that detect and adapt to the user's spoken language automatically. VEDA supports real-time language switching mid-conversation — a visitor can start in English, switch to Hindi, and the robot follows seamlessly.",
      "Configure primary and fallback languages per robot, manage translation quality thresholds, and ensure every persona maintains its character across languages. Ideal for international hotels, airports, and multi-region corporate offices.",
    ],
  },
  {
    title: "Custom Gestures",
    subtitle: "Physical Expression Engine",
    image: "/custom-gesture.webp",
    paragraphs: [
      "Program specific motor sequences that bring your Unitree G1 to life. Map verbal cues to physical actions — a wave when greeting, a pointing gesture when giving directions, or a bow when saying goodbye.",
      "The gesture editor lets you define keyframe sequences, set timing curves, and preview animations before deployment. Chain gestures with speech events so the robot's body language feels natural and synchronized with its words.",
    ],
  },
  {
    title: "Support",
    subtitle: "24/7 Dedicated Assistance",
    image: "/support.webp",
    paragraphs: [
      "Our dedicated support team is available around the clock through an advanced ticketing system. Whether it's a critical deployment issue at 3 AM or a configuration question during business hours, you'll always reach a real engineer.",
      "Every ticket is tracked from creation to resolution with full SLA guarantees. Priority escalation, live diagnostics, and remote debugging ensure your fleet never stays down longer than necessary. We treat your uptime as our responsibility.",
    ],
  },
];

export function FeaturesGrid() {
  return (
    <div className='w-full max-w-6xl mx-auto px-4 pt-40 pb-12 relative z-20'>
      
      {/* Heading Section */}
      <div className='flex flex-col items-center text-center mb-16'>
        <h2 className='text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4'>
          What features you get ?
        </h2>
        <p className='text-gray-500 dark:text-gray-400 text-lg max-w-2xl font-medium leading-relaxed'>
          VEDA is packed with powerful capabilities to help you manage your robotic fleet, customize personas, and connect with your tools — without any overwhelming clutter.
        </p>
      </div>

      {/* Grid */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-5 w-full'>
        {featuresData.map((feature, index) => (
          <MorphingDialog
            key={index}
            transition={{
              type: 'spring',
              bounce: 0.05,
              duration: 0.25,
            }}
          >
            <MorphingDialogTrigger
              style={{ borderRadius: '12px' }}
              className='morph-card flex max-w-full flex-col overflow-hidden border border-border bg-card dark:bg-card hover:shadow-lg hover:shadow-primary/20 hover:border-primary/40'
            >
              <MorphingDialogImage
                src={feature.image}
                alt={feature.title}
                className='h-48 w-full object-cover'
              />
              <div className='flex grow flex-row items-end justify-between px-3 py-2'>
                <div className="text-left">
                  <MorphingDialogTitle className='text-foreground font-semibold'>
                    {feature.title}
                  </MorphingDialogTitle>
                  <MorphingDialogSubtitle className='text-muted-foreground text-sm'>
                    {feature.subtitle}
                  </MorphingDialogSubtitle>
                </div>
                {/* A <span>, not a <button>: the whole card is already the trigger button,
                    and a nested <button> is invalid HTML that forces React to discard the
                    server-rendered landing page and re-render it on the client. */}
                <span
                  aria-hidden='true'
                  className='relative ml-1 flex h-6 w-6 shrink-0 scale-100 select-none appearance-none items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 active:scale-[0.98]'
                >
                  <PlusIcon size={12} />
                </span>
              </div>
            </MorphingDialogTrigger>

            <MorphingDialogContainer>
              <MorphingDialogContent
                style={{ borderRadius: '24px' }}
                className='pointer-events-auto relative flex h-auto w-full flex-col overflow-hidden border border-border bg-card dark:bg-card sm:w-[500px]'
              >
                <MorphingDialogImage
                  src={feature.image}
                  alt={feature.title}
                  className='h-full w-full object-cover'
                />
                <div className='p-6'>
                  <MorphingDialogTitle className='text-2xl text-foreground font-bold'>
                    {feature.title}
                  </MorphingDialogTitle>
                  <MorphingDialogSubtitle className='text-muted-foreground mt-1'>
                    {feature.subtitle}
                  </MorphingDialogSubtitle>
                  <MorphingDialogDescription
                    disableLayoutAnimation
                    variants={{
                      initial: { opacity: 0, scale: 0.8, y: 100 },
                      animate: { opacity: 1, scale: 1, y: 0 },
                      exit: { opacity: 0, scale: 0.8, y: 100 },
                    }}
                  >
                    {feature.paragraphs.map((p, i) => (
                      <p key={i} className={`${i === 0 ? 'mt-4' : 'mt-2'} text-muted-foreground text-sm leading-relaxed`}>
                        {p}
                      </p>
                    ))}
                  </MorphingDialogDescription>
                </div>
                <MorphingDialogClose className='text-foreground' />
              </MorphingDialogContent>
            </MorphingDialogContainer>
          </MorphingDialog>
        ))}
      </div>
    </div>
  );
}
