"use client";

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface DocSectionProps {
  id: string;
  categoryName: string;
  title: string;
  children: React.ReactNode;
}

export function DocSection({ id, categoryName, title, children }: DocSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Use IntersectionObserver to trigger a fade-up animation when the section comes into view
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -50px 0px" });

    // Initial state
    gsap.set(el, { opacity: 0, y: 30 });
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <section id={id} ref={sectionRef} className="scroll-mt-32 mb-20 group">
      <div className="flex items-center gap-2 text-sm font-medium text-primary mb-3 opacity-80 group-hover:opacity-100 transition-opacity">
        <span>{categoryName}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground">{title}</span>
      </div>
      
      <h2 className="text-3xl font-bold tracking-tight text-foreground mb-6 pb-3 border-b border-border/50 relative">
        {title}
        {/* Subtle anchor link indicator */}
        <a href={`#${id}`} className="absolute -left-6 top-1.5 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity text-muted-foreground">
          #
        </a>
      </h2>
      
      <div className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed prose-headings:text-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none">
        {children}
      </div>
    </section>
  );
}
