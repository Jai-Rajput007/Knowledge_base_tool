"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiTerminal,
  FiMessageSquare,
  FiVolume2,
  FiCamera,
  FiFileText,
  FiSettings,
  FiChevronDown,
  FiChevronsRight,
  FiLogOut,
} from "react-icons/fi";
import { motion } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TenantProfileModal } from "@/components/TenantProfileModal";

export const Sidebar = ({ tenant }: { tenant?: any }) => {
  const [open, setOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
    <motion.nav
      layout
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="fixed top-4 left-4 h-[calc(100vh-32px)] shrink-0 border border-border bg-card/90 backdrop-blur-md p-2 z-[60] flex flex-col shadow-lg rounded-2xl transition-shadow hover:shadow-2xl overflow-hidden"
      style={{
        width: open ? "225px" : "fit-content",
      }}
    >
      <TitleSection open={open} onOpenProfile={() => setIsProfileOpen(true)} tenant={tenant} />

      <div className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-14">
        <Option
          Icon={FiTerminal}
          title="MCP"
          href="/mcp"
          selected={pathname === "/mcp"}
          open={open}
        />
        <Option
          Icon={FiMessageSquare}
          title="Chat Simulator"
          href="/chat"
          selected={pathname === "/chat" || pathname.startsWith("/chat/")}
          open={open}
        />
        <Option
          Icon={FiVolume2}
          title="Wake Word"
          href="/wake-word"
          selected={pathname === "/wake-word"}
          open={open}
        />
        <Option
          Icon={FiCamera}
          title="FRS"
          href="/frs"
          selected={pathname === "/frs"}
          open={open}
        />
        <Option
          Icon={FiFileText}
          title="Audit Logs"
          href="/audit-logs"
          selected={pathname === "/audit-logs"}
          open={open}
        />
        <Option
          Icon={FiSettings}
          title="One Settings"
          href="/settings"
          selected={pathname === "/settings"}
          open={open}
        />
        
        <div className="pt-4 mt-4 border-t border-border">
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/';
            }}
            className="relative flex h-10 w-full items-center rounded-md transition-colors text-red-500 hover:bg-red-500/10"
          >
            <motion.div layout className="grid h-full w-10 shrink-0 place-content-center text-lg">
              <FiLogOut />
            </motion.div>
            {open && (
              <motion.span
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.125 }}
                className="text-xs font-medium whitespace-nowrap"
              >
                Log Out
              </motion.span>
            )}
          </button>
        </div>
      </div>
    </motion.nav>
    <TenantProfileModal 
      isOpen={isProfileOpen} 
      onClose={() => setIsProfileOpen(false)} 
      tenant={tenant}
    />
    </>
  );
};

const Option = ({ Icon, title, href, selected, open, notifs }: any) => {
  const router = useRouter();
  
  return (
    <motion.button
      layout
      onClick={() => router.push(href)}
      className={`relative flex h-10 w-full items-center rounded-md transition-colors ${
        selected
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <motion.div
        layout
        className="grid h-full w-10 shrink-0 place-content-center text-lg"
      >
        <Icon />
      </motion.div>
      {open && (
        <motion.span
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.125 }}
          className="text-xs font-medium whitespace-nowrap"
        >
          {title}
        </motion.span>
      )}

      {notifs && open && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          style={{ y: "-50%" }}
          transition={{ delay: 0.5 }}
          className="absolute right-2 top-1/2 size-4 rounded bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center"
        >
          {notifs}
        </motion.span>
      )}
    </motion.button>
  );
};

const TitleSection = ({ open, onOpenProfile, tenant }: { open: boolean, onOpenProfile: () => void, tenant: any }) => {
  const logo = tenant?.companyLogo;
  const initial = tenant?.name ? tenant.name.charAt(0).toUpperCase() : "G";
  const tenantName = tenant?.name || "G1 Universe";

  return (
    <div className="mb-3 border-b border-border pb-3">
      <button 
        onClick={onOpenProfile} 
        className="flex w-full flex-col cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-accent p-2 text-center"
      >
        <motion.div layout className="shrink-0">
          <Avatar className="h-10 w-10 rounded-md border border-border shadow-sm mx-auto">
            {logo ? (
              <AvatarImage src={logo} alt={tenantName} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold rounded-md">
              {initial}
            </AvatarFallback>
          </Avatar>
        </motion.div>
        {open && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ delay: 0.125 }}
            className="mt-2 whitespace-nowrap overflow-hidden"
          >
            <span className="block text-sm font-semibold text-foreground">{tenantName}</span>
          </motion.div>
        )}
      </button>
    </div>
  );
};



