"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider");
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const AceternitySidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

// Exact Aceternity DesktopSidebar — bg-neutral-100/800, animates width
export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-2 py-4 hidden md:flex md:flex-col bg-sidebar w-[300px] shrink-0",
        className
      )}
      animate={{
        width: animate ? (open ? "300px" : "60px") : "300px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className={cn(
        "h-14 shrink-0 px-4 flex flex-row md:hidden items-center justify-between bg-sidebar w-full"
      )}
      {...props}
    >
      <div className="flex items-center gap-3 z-20">
        <button
          type="button"
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setOpen(!open)}
        >
          <IconMenu2 />
        </button>
        <span className="text-base font-semibold text-sidebar-foreground">Veda</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "fixed h-dvh w-full inset-0 bg-sidebar px-6 pt-16 pb-8 sm:p-10 z-[100] flex flex-col justify-between overflow-y-auto",
              className
            )}
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute right-4 top-3 sm:right-10 sm:top-10 z-50 flex h-10 w-10 items-center justify-center rounded-xl text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setOpen(!open)}
            >
              <IconX />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Exact Aceternity SidebarLink — gap-2, icon renders inline, label slides
export const SidebarLink = ({
  link,
  className,
  selected,
  ...props
}: {
  link: Links;
  className?: string;
  selected?: boolean;
}) => {
  const { open, animate } = useSidebar();
  return (
    <a
      href={link.href}
      className={cn(
        "flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg transition-colors",
        selected
          ? "bg-sidebar-accent text-primary"
          : "hover:bg-sidebar-accent",
        className
      )}
      {...props}
    >
      {link.icon}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className={cn(
          "text-sm whitespace-pre inline-block !p-0 !m-0",
          selected
            ? "text-primary font-semibold"
            : "text-sidebar-foreground group-hover/sidebar:translate-x-1 transition duration-150"
        )}
      >
        {link.label}
      </motion.span>
    </a>
  );
};
