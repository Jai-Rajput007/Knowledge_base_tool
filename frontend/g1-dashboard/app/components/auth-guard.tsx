"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const publicRoutes = ["/", "/sign-in"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = publicRoutes.some(r => pathname === r || pathname.startsWith("/sign-in"));
  // Public pages (landing page, sign-in) render immediately instead of being
  // hidden behind the opaque loading screen below — middleware already gates
  // protected routes server-side, so this check only needs to redirect an
  // already-logged-in visitor away from /sign-in, not block first paint.
  const [isLoading, setIsLoading] = useState(!isPublic);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          return res.json().then((data) => {
            // Logged in
            if (data.requiresPasswordChange && pathname !== "/change-password") {
              router.push("/change-password");
            } else if (isPublic) {
              router.push("/dashboard");
            } else {
              setIsLoading(false);
            }
          });
        } else {
          // Not logged in
          if (!isPublic && pathname !== "/change-password") {
            router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
          } else {
            setIsLoading(false);
          }
        }
      })
      .catch(() => {
        if (!isPublic && pathname !== "/change-password") {
          router.push(`/sign-in?redirect=${encodeURIComponent(pathname)}`);
        } else {
          setIsLoading(false);
        }
      });
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
