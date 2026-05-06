"use client";

import Link from "next/link";
import { ExpandingCards, robotFeatures } from "./components/ui/expanding-cards";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-border mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-accent-foreground font-medium">AI-Powered Document Intelligence</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 tracking-tight">
            <span className="text-primary">G1</span> RAG System
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
            Transform your documents into intelligent conversations. 
            Upload, index, and chat with your knowledge base using advanced AI.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:opacity-90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
            >
              Get Started
              <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/chat"
              className="px-8 py-4 bg-card border border-border text-card-foreground rounded-xl font-semibold text-lg hover:bg-accent transition-all"
            >
              Try Demo
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-5xl mx-auto w-full px-4">
          <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2">Smart Upload</h3>
            <p className="text-muted-foreground text-sm">Drag and drop any document. Auto-extract, chunk, and index instantly.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2">AI Chat</h3>
            <p className="text-muted-foreground text-sm">Ask questions in natural language. Get answers with source citations.</p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-card-foreground mb-2">Lightning Fast</h3>
            <p className="text-muted-foreground text-sm">Local vector database. No cloud lag. Privacy-first architecture.</p>
          </div>
        </div>
      </section>

      {/* Robot Features - Expanding Cards Section */}
      <section className="px-4 py-20 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore the cutting-edge capabilities that make our RAG system stand out. 
              Hover over each card to discover more.
            </p>
          </div>
          <ExpandingCards items={robotFeatures} defaultActiveIndex={0} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 bg-accent/30 border-y border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Transform Your Documents?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start building your AI-powered knowledge base today. Upload documents, ask questions, and get intelligent answers.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:opacity-90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
          >
            Get Started Free
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
