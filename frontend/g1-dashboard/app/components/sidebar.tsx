"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  FiTerminal, FiMessageSquare, FiVolume2,
  FiCamera, FiFileText, FiSettings,
  FiBookOpen, FiInfo, FiLifeBuoy, FiLogOut,
} from "react-icons/fi";
import {
  AceternitySidebar,
  SidebarBody,
  SidebarLink,
} from "@/app/components/ui/aceternity-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";

export const Sidebar = ({ tenant, role }: { tenant?: any; role?: string | null }) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isAdmin = role === "admin";

  const topLinks = [
    { label: "Integrations",   href: "/mcp",           icon: <FiTerminal className="h-5 w-5 shrink-0 text-sidebar-foreground" /> },
    { label: "Chat Simulator", href: "/chat",          icon: <FiMessageSquare className="h-5 w-5 shrink-0 text-sidebar-foreground" /> },
    { label: "Wake Word",      href: "/wake-word",     icon: <FiVolume2 className="h-5 w-5 shrink-0 text-sidebar-foreground" /> },
    { label: "FRS",            href: "/employees",     icon: <FiCamera className="h-5 w-5 shrink-0 text-sidebar-foreground" /> },
    ...(isAdmin ? [{ label: "Audit Logs",   href: "/audit-logs",   icon: <FiFileText className="h-5 w-5 shrink-0 text-sidebar-foreground" /> }] : []),
    { label: "Documentation",  href: "/documentation", icon: <FiBookOpen className="h-5 w-5 shrink-0 text-sidebar-foreground" /> },
    { label: "About",          href: "/about",         icon: <FiInfo className="h-5 w-5 shrink-0 text-sidebar-foreground" /> },
  ];

  const bottomLinks = [
    ...(isAdmin ? [{ label: "Settings", href: "/settings", icon: <FiSettings className="h-5 w-5 shrink-0 text-sidebar-foreground" /> }] : []),
  ];



  return (
    <AceternitySidebar open={open} setOpen={setOpen} animate={true}>
      <SidebarBody className="justify-between gap-10">

        {/* ── Top: Brand logo + Nav links ── */}
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {/* Brand mark — matches the reference image's rounded rectangle at top */}
          <BrandLogo open={open} />

          <div className="mt-8 flex flex-col gap-2">
            {topLinks.map((link, idx) => (
              <SidebarLink
                key={idx}
                link={link}
                selected={pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))}
              />
            ))}
          </div>
        </div>

        {/* ── Bottom: Raise Ticket + Settings + Profile Avatar ── */}
        <div className="flex flex-col gap-2">
          <RaiseTicketButton open={open} />

          {bottomLinks.map((link, idx) => (
            <SidebarLink
              key={`b-${idx}`}
              link={link}
              selected={pathname === link.href}
            />
          ))}

          {/* Logout at the very bottom */}
          <LogoutButton open={open} />
        </div>

      </SidebarBody>
    </AceternitySidebar>
  );
};

// ─── Brand Logo ───────────────────────────────────────────────────────────────
// Small rounded-rectangle icon at top of sidebar (like the reference image)
const BrandLogo = ({ open }: { open: boolean }) => {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center space-x-2 py-1 px-2"
    >
      <div className="h-6 w-7 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-sidebar-foreground" />
      <motion.span
        animate={{
          display: open ? "inline-block" : "none",
          opacity: open ? 1 : 0,
        }}
        className="font-semibold whitespace-pre text-sidebar-foreground text-sm !p-0 !m-0"
      >
        Veda
      </motion.span>
    </Link>
  );
};

// ─── Raise a Ticket Button ────────────────────────────────────────────────────
const RaiseTicketButton = ({ open }: { open: boolean }) => {
  return (
    <Link
      href="/tickets"
      className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg border border-primary/25 bg-primary/5 hover:bg-primary/10 transition-colors w-full relative overflow-hidden"
    >
      {/* Subtle pulse glow */}
      <motion.div
        className="absolute inset-0 bg-primary/10 pointer-events-none rounded-lg"
        animate={{ opacity: [0.05, 0.3, 0.05] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      />
      <FiLifeBuoy className="h-5 w-5 shrink-0 text-primary z-10" />
      <motion.span
        animate={{
          display: open ? "inline-block" : "none",
          opacity: open ? 1 : 0,
        }}
        className="text-sm font-bold text-primary whitespace-pre !p-0 !m-0 z-10"
      >
        Raise a Ticket
      </motion.span>
    </Link>
  );
};

// ─── Logout Button ────────────────────────────────────────────────────────────
const LogoutButton = ({ open }: { open: boolean }) => {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/sign-in";
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg transition-colors w-full text-destructive hover:bg-destructive/10"
    >
      <FiLogOut className="h-5 w-5 shrink-0" />
      <motion.span
        animate={{
          display: open ? "inline-block" : "none",
          opacity: open ? 1 : 0,
        }}
        className="text-sm font-medium whitespace-pre !p-0 !m-0"
      >
        Logout
      </motion.span>
    </button>
  );
};
