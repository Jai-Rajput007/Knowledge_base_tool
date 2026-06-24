"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { ThemeToggle } from "./theme-toggle";

export function HeaderActions({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    // Call our secure PASETO logout endpoint
    await fetch('/api/auth/logout', { method: 'POST' });
    
    // Hard refresh so all server components refetch cleanly
    window.location.href = '/sign-in';
  };

  const isAuthPage = pathname.startsWith("/auth") || pathname.startsWith("/sign-in");

  return (
    <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
      <ThemeToggle />
      {!isAuthPage && (
        isLoggedIn ? (
          <button 
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-destructive/10 text-destructive rounded-lg font-semibold hover:bg-destructive/20 transition-colors"
          >
            Logout
          </button>
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
