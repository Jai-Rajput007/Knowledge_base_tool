"use client";

import Link from "next/link";
import dynamic from 'next/dynamic';
import { AnimatedArrowButton } from "@/components/ui/animated-arrow-button";
import { FeaturesGrid } from "@/components/features-grid";

const Spline = dynamic(
  () => import('@splinetool/react-spline'),
  { ssr: false }
);

// Features rendered by FeaturesGrid component

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
                <AnimatedArrowButton text="Sign In to Dashboard" />
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

        <FeaturesGrid />
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
