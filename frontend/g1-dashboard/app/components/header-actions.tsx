"use client";

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

  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
      {/* Notification bell */}
      {!isAuthPage && isLoggedIn && (
        <button
          onClick={() => {
            console.log("[HeaderActions] Navigating to Notifications page");
            router.push("/notifications");
          }}
          className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative shadow-sm"
          title="Notifications"
        >
          <FiBell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
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
            <Avatar className="h-11 w-11 rounded-full border-2 border-border shadow-sm cursor-pointer hover:border-primary transition-colors">
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
