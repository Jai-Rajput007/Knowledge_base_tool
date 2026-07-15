"use client";

import React, { useState, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  FiUser,
  FiDatabase,
  FiMic,
  FiActivity,
  FiBox,
  FiArrowRight,
  FiSmile,
  FiCpu,
  FiSliders,
  FiPlusCircle,
  FiHeart,
  FiRadio,
  FiNavigation,
  FiMap,
  FiMapPin,
  FiCamera
} from "react-icons/fi";

// --- Dropdown Contents ---
const PersonaMenu = () => (
  <div className="w-[300px]">
    <h3 className="mb-3 text-sm font-semibold text-foreground border-b border-border pb-2">Persona Manager</h3>
    <div className="flex flex-col gap-1">
      <a href="/persona#templates" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiBox className="text-lg" /> Persona Templates
      </a>
      <a href="/persona#generative" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiSmile className="text-lg" /> Generative Persona
      </a>
      <a href="/persona#role-builder" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiUser className="text-lg" /> Role Builder
      </a>
    </div>
  </div>
);

const RagMenu = () => (
  <div className="w-[240px]">
    <h3 className="mb-3 text-sm font-semibold text-foreground border-b border-border pb-2">Knowledge Hub</h3>
    <div className="flex flex-col gap-1">
      <a href="/rag#document" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiDatabase className="text-lg" /> Document RAG
      </a>
      <a href="/rag#web" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiCpu className="text-lg" /> Web RAG
      </a>
    </div>
  </div>
);


const GestureMenu = () => (
  <div className="w-[240px]">
    <h3 className="mb-3 text-sm font-semibold text-foreground border-b border-border pb-2">Gesture Settings</h3>
    <div className="flex flex-col gap-1">
      <a href="/gesture#custom" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiActivity className="text-lg" /> Custom Gesture
      </a>
      <a href="/gesture#add" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiPlusCircle className="text-lg" /> Add Gesture
      </a>
    </div>
  </div>
);

const InventoryMenu = () => (
  <div className="w-[240px]">
    <h3 className="mb-3 text-sm font-semibold text-foreground border-b border-border pb-2">Robot Inventory</h3>
    <div className="flex flex-col gap-1">
      <a href="/inventory#health" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiHeart className="text-lg" /> Health Status
      </a>
    </div>
  </div>
);


export type NavItem = {
  id: string;
  icon: React.ReactElement;
  label: string;
  href: string;
  dropdownComponent?: React.FC;
};

const NavigationMenu = () => (
  <div className="p-3 w-48">
    <h3 className="mb-3 text-sm font-semibold text-foreground border-b border-border pb-2">Navigation</h3>
    <div className="space-y-1">
      <a href="/navigation#navigate" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiMapPin className="text-lg" /> Go to Location
      </a>
      <a href="/navigation#mapping" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiMap className="text-lg" /> Mapping
      </a>
      <a href="/navigation#status" className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
        <FiNavigation className="text-lg" /> Status
      </a>
    </div>
  </div>
);


const defaultNavItems: NavItem[] = [
  { id: "persona",    icon: <FiUser />,       label: "Persona Manager",  href: "/persona",     dropdownComponent: PersonaMenu },
  { id: "rag",        icon: <FiDatabase />,   label: "Knowledge Hub",        href: "/rag",         dropdownComponent: RagMenu },
  { id: "navigation", icon: <FiNavigation />, label: "Navigation",       href: "/navigation",  dropdownComponent: NavigationMenu },
  { id: "gesture",    icon: <FiActivity />,   label: "Gesture Settings", href: "/gesture",     dropdownComponent: GestureMenu },
  { id: "inventory",  icon: <FiBox />,        label: "Robot Inventory",  href: "/inventory",   dropdownComponent: InventoryMenu },
];

export const LimelightNav = ({
  items = defaultNavItems,
  role
}: { items?: NavItem[], role?: string | null }) => {
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dir, setDir] = useState<"l" | "r" | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [limelightCenter, setLimelightCenter] = useState(0);
  
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = role === "admin";
  const isEditor = role === "editor" || isAdmin;

  // Filter items based on role
  const visibleItems = items.filter(item => {
    if (item.id === "inventory" && !isAdmin) return false; // Only Admin sees Inventory
    return true;
  });

  useLayoutEffect(() => {
    const index = visibleItems.findIndex((item) => item.href === pathname);
    if (index >= 0) {
      setActiveIndex(index);
    }
  }, [pathname, visibleItems]);

  const handleSetHovered = (index: number | null) => {
    if (typeof hoveredIndex === "number" && typeof index === "number") {
      setDir(hoveredIndex > index ? "r" : "l");
    } else if (index === null) {
      setDir(null);
    }
    setHoveredIndex(index);
  };

  const targetIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;

  useLayoutEffect(() => {
    if (visibleItems.length === 0) return;

    const limelight = limelightRef.current;
    const targetItem = navItemRefs.current[targetIndex];

    if (limelight && targetItem) {
      const center = targetItem.offsetLeft + targetItem.offsetWidth / 2;
      setLimelightCenter(center);
      
      const newLeft = center - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [targetIndex, isReady, visibleItems]);

  if (visibleItems.length === 0 || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <div 
      className="sticky top-6 z-50 flex justify-center w-full" 
      onMouseLeave={() => handleSetHovered(null)}
    >
      <div className="relative">
        <nav
          className="relative flex items-center h-16 rounded-2xl bg-card/70 text-card-foreground border border-border/50 shadow-lg px-2 backdrop-blur-lg"
          style={{ boxShadow: `0 10px 40px -10px var(--shadow-color)` }}
        >
        {visibleItems.map((item, index) => {
          const isActive = activeIndex === index;
          const isHovered = hoveredIndex === index;
          const isHighlighted = isHovered || (hoveredIndex === null && isActive);

          return (
            <Link
              key={item.id}
              href={item.href}
              ref={(el) => {
                navItemRefs.current[index] = el;
              }}
              onMouseEnter={() => handleSetHovered(index)}
              className="relative z-20 flex items-center justify-center gap-2 px-4 py-2 cursor-pointer group"
            >
              {React.cloneElement(item.icon, {
                className: `w-4 h-4 transition-all duration-300 ease-in-out ${
                  isHighlighted
                    ? "text-primary scale-110"
                    : "text-muted-foreground group-hover:text-foreground"
                }`,
              } as any)}
              <span
                className={`text-xs font-semibold transition-all duration-300 ease-in-out ${
                  isHighlighted
                    ? "text-primary opacity-100"
                    : "text-muted-foreground opacity-60 group-hover:text-foreground group-hover:opacity-100"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Limelight indicator line */}
        <div
          ref={limelightRef}
          className={`absolute -top-[2px] z-10 w-12 h-[2px] rounded-full bg-primary shadow-[0_0_20px_var(--primary),0_0_40px_var(--primary)] ${
            isReady ? "transition-all duration-300 ease-out" : ""
          }`}
          style={{ left: "-999px" }}
        >
          <div className="absolute left-[-50%] top-[2px] w-[200%] h-12 [clip-path:polygon(10%_100%,30%_0,70%_0,90%_100%)] bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
        </div>
      </nav>

      {/* Dropdown renders below the nav, inside the hover-tracking wrapper */}
      <AnimatePresence>
        {hoveredIndex !== null && visibleItems[hoveredIndex]?.dropdownComponent && (
          <DropdownContent 
            dir={dir} 
            selectedItem={visibleItems[hoveredIndex]} 
            center={limelightCenter}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

// --- Dropdown Sub-components ---
const DropdownContent = ({ selectedItem, dir, center }: any) => {
  const Component = selectedItem.dropdownComponent;

  return (
    <motion.div
      id="overlay-content"
      initial={{ opacity: 0, y: 8, x: `calc(${center}px - 50%)` }}
      animate={{ opacity: 1, y: 0, x: `calc(${center}px - 50%)` }}
      exit={{ opacity: 0, y: 8, x: `calc(${center}px - 50%)` }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="absolute top-full mt-3 left-0 rounded-xl border border-border bg-card shadow-2xl z-50 w-fit"
    >
      {/* Invisible bridge from nav bottom to dropdown top */}
      <div className="absolute -top-[12px] left-1/2 -translate-x-1/2 w-[200%] h-[12px]" />
      
      {/* Nub is always centered on the dropdown */}
      <div className="absolute top-0 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-tl border border-border bg-card" style={{ clipPath: "polygon(0 0, 100% 0, 50% 50%, 0% 100%)" }} />

      <div className="overflow-hidden rounded-xl">
        <motion.div
          key={selectedItem.id}
          initial={{ opacity: 0, x: dir === "l" ? 80 : dir === "r" ? -80 : 0 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="p-3"
        >
          <Component />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default LimelightNav;
