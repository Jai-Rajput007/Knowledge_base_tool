"use client";

import React, { useState, useRef, useLayoutEffect, cloneElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// SVG Icons
const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const DashboardIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

const LibraryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    <path d="M8 7h6" /><path d="M8 11h6" /><path d="M8 15h4" />
  </svg>
);

const ChatIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export type NavItem = {
  id: string;
  icon: React.ReactElement;
  label: string;
  href: string;
};

const defaultNavItems: NavItem[] = [
  { id: "home", icon: <HomeIcon />, label: "Home", href: "/" },
  { id: "dashboard", icon: <DashboardIcon />, label: "Dashboard", href: "/dashboard" },
  { id: "library", icon: <LibraryIcon />, label: "Library", href: "/library" },
  { id: "chat", icon: <ChatIcon />, label: "Chat", href: "/chat" },
  { id: "settings", icon: <SettingsIcon />, label: "Settings", href: "/settings" },
];

type LimelightNavProps = {
  items?: NavItem[];
  className?: string;
};

export const LimelightNav = ({
  items = defaultNavItems,
  className = "",
}: LimelightNavProps) => {
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(() => {
    const index = items.findIndex((item) => item.href === pathname);
    return index >= 0 ? index : 0;
  });
  const [isReady, setIsReady] = useState(false);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const index = items.findIndex((item) => item.href === pathname);
    if (index >= 0) {
      setActiveIndex(index);
    }
  }, [pathname, items]);

  useLayoutEffect(() => {
    if (items.length === 0) return;

    const limelight = limelightRef.current;
    const activeItem = navItemRefs.current[activeIndex];

    if (limelight && activeItem) {
      const newLeft =
        activeItem.offsetLeft + activeItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [activeIndex, isReady, items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 inline-flex items-center h-20 rounded-2xl bg-card text-card-foreground border border-border shadow-lg px-3 backdrop-blur-md ${className}`}
      style={{ boxShadow: `0 10px 40px -10px var(--shadow-color)` }}
    >
      {items.map(({ id, icon, label, href }, index) => (
        <Link
          key={id}
          href={href}
          ref={(el) => {
            navItemRefs.current[index] = el;
          }}
          className="relative z-20 flex flex-col items-center justify-center gap-1 px-4 py-2 cursor-pointer group"
        >
          {React.cloneElement(icon, {
            className: `w-5 h-5 transition-all duration-300 ease-in-out ${
              activeIndex === index
                ? "text-primary scale-110"
                : "text-muted-foreground group-hover:text-foreground"
            }`,
          } as any)}
          <span
            className={`text-[10px] font-medium transition-all duration-300 ease-in-out ${
              activeIndex === index
                ? "text-primary translate-y-0 opacity-100"
                : "text-muted-foreground translate-y-0.5 opacity-60 group-hover:text-foreground group-hover:opacity-100"
            }`}
          >
            {label}
          </span>
        </Link>
      ))}

      {/* Limelight indicator */}
      <div
        ref={limelightRef}
        className={`absolute -top-[3px] z-10 w-12 h-[3px] rounded-full bg-primary shadow-[0_0_20px_var(--primary),0_0_40px_var(--primary)] ${
          isReady ? "transition-all duration-400 ease-out" : ""
        }`}
        style={{ left: "-999px" }}
      >
        {/* Glow effect below the line */}
        <div className="absolute left-[-50%] top-[3px] w-[200%] h-16 [clip-path:polygon(10%_100%,30%_0,70%_0,90%_100%)] bg-gradient-to-b from-primary/25 to-transparent pointer-events-none" />
      </div>
    </nav>
  );
};

export default LimelightNav;
