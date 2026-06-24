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

export const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  return (
    <motion.nav
      layout
      className="fixed top-0 left-0 h-screen shrink-0 border-r border-border bg-card p-2 z-[60] flex flex-col shadow-sm"
      style={{
        width: open ? "225px" : "fit-content",
      }}
    >
      <TitleSection open={open} />

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

      <ToggleClose open={open} setOpen={setOpen} />
    </motion.nav>
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

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="mb-3 border-b border-border pb-3">
      <Link href="/dashboard" className="flex cursor-pointer items-center justify-between rounded-md transition-colors hover:bg-accent p-1">
        <div className="flex items-center gap-2">
          <Logo />
          {open && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.125 }}
              className="whitespace-nowrap"
            >
              <span className="block text-xs font-semibold text-foreground">G1 Universe</span>
              <span className="block text-xs text-muted-foreground">Pro Plan</span>
            </motion.div>
          )}
        </div>
        {open && <FiChevronDown className="mr-2 text-muted-foreground" />}
      </Link>
    </div>
  );
};

const Logo = () => {
  return (
    <motion.div
      layout
      className="grid size-10 shrink-0 place-content-center rounded-md bg-primary"
    >
      <svg
        width="24"
        height="auto"
        viewBox="0 0 50 39"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-primary-foreground"
      >
        <path
          d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z"
        ></path>
        <path
          d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z"
        ></path>
      </svg>
    </motion.div>
  );
};

const ToggleClose = ({ open, setOpen }: { open: boolean; setOpen: any }) => {
  return (
    <motion.button
      layout
      onClick={() => setOpen((pv: boolean) => !pv)}
      className="absolute bottom-0 left-0 right-0 border-t border-border bg-card transition-colors hover:bg-accent text-muted-foreground hover:text-foreground"
    >
      <div className="flex items-center p-2">
        <motion.div
          layout
          className="grid size-10 shrink-0 place-content-center text-lg"
        >
          <FiChevronsRight
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </motion.div>
        {open && (
          <motion.span
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.125 }}
            className="text-xs font-medium"
          >
            Collapse
          </motion.span>
        )}
      </div>
    </motion.button>
  );
};
