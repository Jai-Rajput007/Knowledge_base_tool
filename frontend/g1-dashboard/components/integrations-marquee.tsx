"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  SiGoogle,
  SiSlack,
  SiNotion,
  SiGithub,
  SiJira,
  SiFigma,
  SiStripe,
  SiShopify,
  SiAsana,
  SiAtlassian,
  SiAirtable,
  SiHubspot,
  SiTwilio,
  SiDropbox,
  SiZoom,
  SiMiro,
  SiSalesforce,
  SiZapier,
  SiLinear,
  SiGooglecalendar,
  SiGmail,
  SiGoogledrive,
  SiGoogledocs,
  SiGooglesheets,
  SiGooglemeet,
  SiTrello,
  SiGooglechat,
  SiGoogleforms,
} from "react-icons/si";

interface IntegrationItem {
  name: string;
  icon: React.ElementType;
  color: string;
}

const integrations: IntegrationItem[] = [
  { name: "Google",           icon: SiGoogle,          color: "#4285F4" },
  { name: "Slack",            icon: SiSlack,           color: "#4A154B" },
  { name: "Notion",           icon: SiNotion,          color: "#000000" },
  { name: "GitHub",           icon: SiGithub,          color: "#181717" },
  { name: "Jira",             icon: SiJira,            color: "#0052CC" },
  { name: "Figma",            icon: SiFigma,           color: "#F24E1E" },
  { name: "Stripe",           icon: SiStripe,          color: "#635BFF" },
  { name: "Shopify",          icon: SiShopify,         color: "#96BF48" },
  { name: "Asana",            icon: SiAsana,           color: "#F06A6A" },
  { name: "Atlassian",        icon: SiAtlassian,       color: "#0052CC" },
  { name: "Airtable",         icon: SiAirtable,        color: "#18BFFF" },
  { name: "HubSpot",          icon: SiHubspot,         color: "#FF7A59" },
  { name: "Twilio",           icon: SiTwilio,          color: "#F22F46" },
  { name: "Dropbox",          icon: SiDropbox,         color: "#0061FF" },
  { name: "Zoom",             icon: SiZoom,            color: "#2D8CFF" },
  { name: "Miro",             icon: SiMiro,            color: "#FFD02F" },
  { name: "Salesforce",       icon: SiSalesforce,      color: "#00A1E0" },
  { name: "Zapier",           icon: SiZapier,          color: "#FF4A00" },
  { name: "Linear",           icon: SiLinear,          color: "#5E6AD2" },
  { name: "Google Calendar",  icon: SiGooglecalendar,  color: "#4285F4" },
  { name: "Gmail",            icon: SiGmail,           color: "#EA4335" },
  { name: "Google Drive",     icon: SiGoogledrive,     color: "#34A853" },
  { name: "Google Docs",      icon: SiGoogledocs,      color: "#4285F4" },
  { name: "Google Sheets",    icon: SiGooglesheets,    color: "#34A853" },
  { name: "Google Meet",      icon: SiGooglemeet,      color: "#00AC47" },
  { name: "Google Chat",      icon: SiGooglechat,      color: "#4285F4" },
  { name: "Google Forms",     icon: SiGoogleforms,     color: "#8430CE" },
  { name: "Trello",           icon: SiTrello,          color: "#0052CC" },
];

// Triplicate for seamless infinite loop
const loopItems = [...integrations, ...integrations, ...integrations];

  export function IntegrationsMarquee() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="w-full py-24 overflow-hidden flex flex-col justify-center">
      {/* Header — clean standard flow, no messy overlapping */}
      <div className="w-full max-w-7xl mx-auto px-4 mb-8">
        <h2 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
          What you can{" "}
          <span className="text-primary">Connect?</span>
        </h2>
      </div>

      {/* Strip band */}
      <div className="relative w-full border-y border-border bg-card/60 dark:bg-card/80 overflow-hidden py-8 shadow-sm"
        onMouseEnter={() => setHoveredIndex(hoveredIndex)} // just to capture mouse if needed
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Left fade mask */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10 bg-gradient-to-r from-background to-transparent" />
        {/* Right fade mask */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10 bg-gradient-to-l from-background to-transparent" />

        {/* Scrolling track */}
        <div
          className="flex items-center gap-12 w-max"
          style={{
            animation: "marquee-scroll 45s linear infinite",
            animationPlayState: hoveredIndex !== null ? "paused" : "running",
          }}
        >
          {loopItems.map((item, i) => {
            const realIndex = i % integrations.length;
            const isHovered = hoveredIndex === realIndex;
            const isDimmed = hoveredIndex !== null && !isHovered;
            const Icon = item.icon;

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(realIndex)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg shrink-0 cursor-default select-none transition-all duration-300"
                style={{
                  opacity: isDimmed ? 0.2 : 1,
                  filter: isDimmed ? "grayscale(100%)" : "none",
                  transform: isHovered ? "scale(1.05)" : "scale(1)",
                }}
              >
                <Icon
                  size={32}
                  style={{
                    color: item.color,
                    transition: "color 0.3s ease",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="text-lg md:text-xl font-bold whitespace-nowrap"
                  style={{
                    color: item.color,
                    transition: "color 0.3s ease",
                  }}
                >
                  {item.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
