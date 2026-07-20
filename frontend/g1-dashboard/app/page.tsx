"use client";

import Link from "next/link";
import dynamic from 'next/dynamic';
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatedArrowButton } from "@/components/ui/animated-arrow-button";
import { FeaturesGrid } from "@/components/features-grid";
import { IntegrationsMarquee } from "@/components/integrations-marquee";
import { HowItWorks } from "@/components/how-it-works";
import { SecurityFeatures } from "@/components/security-features";
import { WaitlistSection } from "@/components/waitlist-section";
import { SocialCard } from "@/components/social-card";

gsap.registerPlugin(ScrollTrigger);

const Spline = dynamic(
  () => import('@splinetool/react-spline'),
  { ssr: false }
);

const systemInfo = [];

export default function Home() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subheadingRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const splineRef = useRef<HTMLDivElement>(null);
  const vedaRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {

      // ── Hero: staggered entrance on page load ──────────────────────────
      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

      heroTl
        .from(badgeRef.current, { opacity: 0, y: -20, duration: 0.6 })
        .from(headingRef.current, { opacity: 0, y: 40, duration: 0.7 }, "-=0.3")
        .from(subheadingRef.current, { opacity: 0, y: 30, duration: 0.6 }, "-=0.4")
        .from(descRef.current, { opacity: 0, y: 25, duration: 0.6 }, "-=0.4")
        .from(buttonRef.current, { opacity: 0, y: 20, duration: 0.5 }, "-=0.3")
        .from(vedaRef.current, { opacity: 0, scale: 0.85, duration: 1.2, ease: "power2.out" }, "-=0.8")
        .from(splineRef.current, { opacity: 0, scale: 0.95, duration: 1.0, ease: "power2.out" }, "-=1.0");

      // ── Performance: hide all below-fold sections so browser skips paint ──
      // visibility:hidden tells browser to skip layout+paint entirely (unlike opacity:0)
      // visibility:hidden tells browser to skip layout+paint entirely (unlike opacity:0)
      gsap.set(
        [featuresRef.current, footerRef.current],
        { visibility: "hidden" }
      );

      // ── Feature Cards: ScrollTrigger.batch — only processes cards entering viewport ──
      // More efficient than animating all 8 at once; GSAP batches DOM reads per tick
      ScrollTrigger.batch(".morph-card", {
        start: "top 90%",
        onEnter: (elements) => {
          gsap.set(featuresRef.current, { visibility: "visible" });
          gsap.from(elements, {
            opacity: 0,
            y: 50,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            onComplete: () => gsap.set(elements, { clearProps: "will-change" }),
          });
        },
        once: true, // only fires once — no re-animation on scroll back up
      });

      // ── Footer ───────────────────────────────────────────────────────
      ScrollTrigger.create({
        trigger: footerRef.current,
        start: "top 95%",
        once: true,
        onEnter: () => {
          gsap.set(footerRef.current, { visibility: "visible" });
          gsap.from(footerRef.current, {
            opacity: 0,
            y: 15,
            duration: 0.5,
            ease: "power2.out",
          });
        },
      });

    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-10 lg:py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">

          {/* Left Content */}
          <div className="text-left">
            <div ref={badgeRef} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-border mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-accent-foreground font-medium">System Online</span>
            </div>

            <h1 ref={headingRef} className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight leading-tight">
              Robot In Your <span className="text-primary">Hands</span>
            </h1>
            <p ref={subheadingRef} className="text-lg text-primary mb-3 font-bold uppercase tracking-widest">
              Control your Unitree robots with VEDA
            </p>

            <p ref={descRef} className="text-base text-muted-foreground mb-10 max-w-xl leading-relaxed">
              The ultimate command center for your humanoid robotics fleet. Deploy advanced knowledge bases, configure real-time integrations, and seamlessly orchestrate robot actions from a single, powerful interface.
            </p>

            <div ref={buttonRef} className="flex flex-col sm:flex-row items-center sm:items-start justify-start gap-4 mb-10">
              <Link href="/sign-in" className="w-full sm:w-auto">
                <AnimatedArrowButton text="Sign In to Dashboard" />
              </Link>
            </div>
          </div>

          {/* Right Spline 3D Model with Background Text */}
          <div className="h-[400px] lg:h-[600px] w-full relative flex items-center justify-center">

            {/* Giant VEDA Background Text */}
            <div ref={vedaRef} className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 -translate-y-12 lg:-translate-y-20">
              <h2 className="text-[120px] lg:text-[220px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground/20 dark:from-foreground/30 to-foreground/0 select-none leading-none">
                VEDA
              </h2>
            </div>

            {/* The Spline Robot */}
            <div ref={splineRef} className="absolute inset-0 z-10">
              <Spline scene="/scene.splinecode" />
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div ref={featuresRef}>
          <FeaturesGrid />
        </div>

        {/* Integrations Marquee */}
        <IntegrationsMarquee />

        {/* How It Works */}
        <HowItWorks />

        {/* Security Section */}
        <SecurityFeatures />

        {/* Waitlist Call to Action */}
        <WaitlistSection />
      </section>

      {/* Footer */}
      <div ref={footerRef} className="py-8 px-4 md:px-12 flex flex-col md:flex-row items-center justify-between border-t border-border gap-6 bg-background">
        <div>
          <SocialCard />
        </div>
        <div className="text-center md:text-right text-xs text-muted-foreground max-w-sm leading-relaxed">
          <p className="font-semibold text-foreground mb-1">
            &copy; {new Date().getFullYear()} Bidyut Innovation Ltd.
          </p>
          <p>
            Proprietary and Confidential. Licensed exclusively for authorized 
            internal robotics fleet operations. All telemetry and operational 
            data is encrypted and stored strictly on-premise.
          </p>
        </div>
      </div>
    </div>
  );
}
