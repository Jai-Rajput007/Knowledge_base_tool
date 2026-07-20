"use client";

import React, { useEffect, useState } from 'react';
import { docCategories } from '../data/docs-content';

export function DocSidebar() {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      let current = "";
      
      // Add offset to make highlighting feel more natural before the section reaches the exact top
      const scrollPosition = window.scrollY + 200;
      
      sections.forEach((section) => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (scrollPosition >= sectionTop) {
          current = section.getAttribute('id') || "";
        }
      });
      
      setActiveId(current);
    };

    window.addEventListener('scroll', handleScroll);
    // Trigger once on load in case URL has hash
    handleScroll();
    
    // Check hash on load
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(id);
      }, 100);
    }
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.pushState(null, '', `#${id}`);
    setActiveId(id);
  };

  return (
    <nav className="w-64 flex-shrink-0 hidden lg:block sticky top-32 h-[calc(100vh-8rem)] overflow-y-auto pr-6 pb-10">
      <div className="space-y-8">
        {docCategories.map((category) => (
          <div key={category.id} className="sidebar-group">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest mb-3 px-2">
              {category.name}
            </h3>
            <ul className="space-y-1">
              {category.sections.map((sectionId) => {
                // Find readable title for sidebar (handle special cases)
                let title = sectionId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                if (sectionId === 'mcp-integrations') title = 'Integrations (MCP)';
                if (sectionId === 'knowledge-base') title = 'Knowledge Base (RAG)';
                if (sectionId === 'facial-recognition') title = 'Facial Recognition (FRS)';
                
                const isActive = activeId === sectionId;
                
                return (
                  <li key={sectionId}>
                    <a
                      href={`#${sectionId}`}
                      onClick={(e) => handleClick(e, sectionId)}
                      className={`block px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
                        isActive 
                          ? 'bg-primary/10 text-primary font-semibold' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
