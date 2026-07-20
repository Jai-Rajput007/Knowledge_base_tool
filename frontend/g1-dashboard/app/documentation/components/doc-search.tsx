"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, X } from 'lucide-react';
import { docsContent, DocSection } from '../data/docs-content';

export function DocSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DocSection[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const filtered = docsContent.filter(doc => 
      doc.title.toLowerCase().includes(q) || 
      doc.keywords.some(k => k.toLowerCase().includes(q))
    );
    
    setResults(filtered.slice(0, 8)); // Max 8 results
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setIsOpen(false);
    setQuery("");
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.pushState(null, '', `#${id}`);
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-[300px] md:min-w-[400px] max-w-md z-50">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-sm text-sm"
          placeholder="Search documentation (e.g. 'persona')..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button 
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.trim() !== "" && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {results.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Search Results
              </div>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between group transition-colors border-b border-border/50 last:border-0"
                >
                  <div>
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {result.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {result.categoryName}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-2">No results found for "{query}"</p>
              <p className="text-sm text-muted-foreground/70">
                Try searching for: <span className="text-primary cursor-pointer hover:underline" onClick={() => {setQuery("persona"); setIsOpen(true);}}>persona</span>, <span className="text-primary cursor-pointer hover:underline" onClick={() => {setQuery("wakeword"); setIsOpen(true);}}>wakeword</span>, <span className="text-primary cursor-pointer hover:underline" onClick={() => {setQuery("FRS"); setIsOpen(true);}}>FRS</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
