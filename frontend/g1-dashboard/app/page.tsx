"use client";

import Link from "next/link";
import dynamic from 'next/dynamic';
import { ShimmerButton } from "@/components/ui/shimmer-button";

const Spline = dynamic(
  () => import('@splinetool/react-spline'),
  { ssr: false }
);

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Document Library",
    description: "Upload manuals, SOPs, and reference documents. Automatically indexed and ready for the robot to query.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "Knowledge Base Chat",
    description: "Test the knowledge base directly. Ask questions the robot would ask and verify its responses.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Robot Integration",
    description: "The G1 robot queries this system in real time. Documents uploaded here become the robot's knowledge.",
  },
];

const systemInfo = [
  { label: "Deployment", value: "On-Premise" },
  { label: "Data Storage", value: "Local Only" },
  { label: "LLM", value: "Ollama (Offline)" },
  { label: "Robot Model", value: "Unitree G1" },
];

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-10 lg:py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          
          {/* Left Content */}
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-border mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-accent-foreground font-medium">System Online</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight leading-tight">
              Robot In Your <span className="text-primary">Hands</span>
            </h1>
            <p className="text-lg text-primary mb-3 font-bold uppercase tracking-widest">
              Control your Unitree robots with VEDA
            </p>

            <p className="text-base text-muted-foreground mb-10 max-w-xl leading-relaxed">
              The ultimate command center for your humanoid robotics fleet. Deploy advanced knowledge bases, configure real-time integrations, and seamlessly orchestrate robot actions from a single, powerful interface.
            </p>

            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-start gap-4 mb-10">
              <Link href="/sign-in" className="w-full sm:w-auto">
                <ShimmerButton background="var(--primary)" className="shadow-lg shadow-primary/25 w-full sm:w-auto px-8 py-4 rounded-xl">
                  <span className="flex items-center gap-2 font-semibold text-lg text-primary-foreground whitespace-nowrap">
                    Sign In to Dashboard
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </ShimmerButton>
              </Link>
            </div>
          </div>

          {/* Right Spline 3D Model with Background Text */}
          <div className="h-[400px] lg:h-[600px] w-full relative flex items-center justify-center">
            
            {/* Giant VEDA Background Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 -translate-y-12 lg:-translate-y-20">
              <h2 className="text-[120px] lg:text-[220px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground/20 dark:from-foreground/30 to-foreground/0 select-none leading-none">
                VEDA
              </h2>
            </div>

            {/* The Spline Robot */}
            <div className="absolute inset-0 z-10">
              <Spline 
                scene="/scene.splinecode" 
              />
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl mx-auto w-full px-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/40 transition-all">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-card-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* System Info Strip */}
      <section className="px-4 py-10 border-y border-border bg-card/50">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-6">System Configuration</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {systemInfo.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 bg-background">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload Documents",
                desc: "Admin uploads manuals, procedures, or reference material through the Library section.",
              },
              {
                step: "02",
                title: "Automatic Indexing",
                desc: "Documents are chunked, embedded, and stored in the local vector database on this machine.",
              },
              {
                step: "03",
                title: "Robot Queries in Real Time",
                desc: "When a visitor asks the G1 robot a question, it retrieves the relevant answer from this system.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-3">
                <span className="text-4xl font-bold text-primary/20">{item.step}</span>
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="py-6 text-center text-xs text-muted-foreground border-t border-border">
        Internal system &mdash; authorised personnel only. All data is stored locally on this device.
      </div>
    </div>
  );
}
