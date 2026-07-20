"use client";

import React, { useState } from 'react';
import { WaitlistButton } from "@/components/waitlist-button";

export function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Trigger the animation
    setIsSent(true);
    
    // Clear the email field so it visually resets
    setEmail("");

    // Reset the button after 3 seconds so they can submit again if they want
    setTimeout(() => {
      setIsSent(false);
    }, 3000);
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="w-full flex flex-col items-center justify-center py-24 pb-32 gap-8 relative"
    >
      <div className="text-center mb-2">
        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
          Ready to deploy?
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Join the waitlist for early access to the VEDA operating system.
        </p>
      </div>
      
      <div className="relative w-full max-w-sm group">
        <input
          type="email"
          id="waitlist-email"
          placeholder=" "
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="peer w-full h-16 bg-background border-2 border-border rounded-2xl px-6 pt-5 pb-1 text-foreground text-lg focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 shadow-sm"
        />
        <label
          htmlFor="waitlist-email"
          className="absolute left-6 top-2 text-xs font-semibold text-muted-foreground transition-all duration-300 pointer-events-none
            peer-placeholder-shown:top-5 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal
            peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-primary"
        >
          Enter your email address
        </label>
        
        {/* Animated Bottom Highlight */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-primary transition-all duration-500 peer-focus:w-[80%] rounded-full opacity-0 peer-focus:opacity-100" />
      </div>

      <WaitlistButton isSent={isSent} />
    </form>
  );
}
