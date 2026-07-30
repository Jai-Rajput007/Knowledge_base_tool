import { NextRequest, NextResponse } from "next/server";

// Cookie name must match lib/auth.ts
const SESSION_COOKIE = "g1_session";

// Routes that are publicly accessible (no auth required)
const PUBLIC_ROUTES = ["/sign-in", "/api/auth/login", "/api/auth/logout"];

// Routes that should bypass middleware entirely (Next.js internals, static assets)
const BYPASS_PREFIXES = ["/_next", "/favicon", "/public", "/icons", "/images"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always bypass for Next.js internals and static files
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const hasSession = Boolean(sessionCookie?.value);

  // 2. Public route handling
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  );

  if (isPublicRoute) {
    // If already logged in and visiting /sign-in, redirect to dashboard
    if (hasSession && pathname.startsWith("/sign-in")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 3. Protected route: no session cookie → redirect BEFORE any HTML is sent
  // This is the key improvement over AuthGuard: server-side, zero HTML leakage.
  if (!hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 4. Has session cookie → allow through.
  // Full PASETO cryptographic verification happens inside each API route via verifyToken().
  // Middleware only checks cookie presence (Edge runtime has no Node.js crypto).
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
