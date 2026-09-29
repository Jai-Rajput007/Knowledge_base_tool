"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { FiBell } from "react-icons/fi";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";

/**
 * HeaderActions Component
 *
 * Displays top-right global actions: Notifications, Theme Toggle, and Profile Avatar (or Login).
 * UPDATED: Replaced Logout button with a Profile Avatar link.
 *          Logout is now in the sidebar.
 */

export function HeaderActions({ isLoggedIn = false, tenant }: { isLoggedIn?: boolean; tenant?: any }) {
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = pathname.startsWith("/auth") || pathname.startsWith("/sign-in");

  // Build the avatar for the profile link
  const logo = tenant?.companyLogo;
  const initial = tenant?.name ? tenant.name.charAt(0).toUpperCase() : "U";
  const tenantName = tenant?.name || "User Profile";

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || isAuthPage) return;

    const checkNotifications = async () => {
      try {
        const { api } = await import("@/lib/api");
        // Using request method since get is private/not exposed
        const response = await (api as any).request("/notifications");
        const notifs = response.data || [];
        const count = notifs.filter((n: any) => !n.is_read).length;
        setUnreadCount(count);
      } catch (e) {
        console.error("Failed to fetch notification count", e);
      }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [isLoggedIn, isAuthPage]);

  return (
    <div className="fixed top-2 right-3 md:top-6 md:right-6 z-50 flex items-center gap-2 md:gap-3">
      {/* Notification bell */}
      {!isAuthPage && isLoggedIn && (
        <button
          onClick={() => {
            router.push("/notifications");
            // Optimistically clear the dot when they click
            setUnreadCount(0); 
          }}
          className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative shadow-sm"
          title="Notifications"
        >
          <FiBell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full animate-pulse border-2 border-card" />
          )}
        </button>
      )}

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Profile avatar (logged in) or Login button (logged out) */}
      {!isAuthPage && (
        isLoggedIn ? (
          <Link
            href="/profile"
            className="rounded-full hover:ring-2 hover:ring-primary/40 transition-all"
            title="Profile"
          >
            <Avatar className="h-10 w-10 md:h-11 md:w-11 rounded-full border-2 border-border shadow-sm cursor-pointer hover:border-primary transition-colors">
              {logo ? <AvatarImage src={logo} alt={tenantName} className="object-cover rounded-full" /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-[15px] rounded-full">
                {initial}
              </AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            Login
          </Link>
        )
      )}
    </div>
  );
}
