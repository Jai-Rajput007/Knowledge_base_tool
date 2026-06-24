"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const publicRoutes = ["/", "/sign-in", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check our PASETO cookie-based session via /api/auth/me
    fetch("/api/auth/me")
      .then((res) => {
        const isPublic = publicRoutes.includes(pathname);

        if (res.ok) {
          // Logged in — redirect away from public pages
          if (isPublic && (pathname === "/auth/login" || pathname === "/auth/register" || pathname === "/")) {
            router.push("/dashboard");
          } else {
            setIsLoading(false);
          }
        } else {
          // Not logged in — redirect to sign-in if on a protected page
          if (!isPublic) {
            router.push("/sign-in");
          } else {
            setIsLoading(false);
          }
        }
      })
      .catch(() => {
        if (!publicRoutes.includes(pathname)) {
          router.push("/sign-in");
        } else {
          setIsLoading(false);
        }
      });
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
