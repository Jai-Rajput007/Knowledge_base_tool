import React from 'react';

export const getIcon = (name: string, className?: string) => {
  // Simple fallback icon system for the placeholder components
  return (
    <svg className={className || "w-4 h-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
