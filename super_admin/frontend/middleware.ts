import { NextRequest, NextResponse } from "next/server";
import { verifySAToken } from "@/lib/auth";

const SA_COOKIE_NAME = "sa_session";

// Public routes — accessible without a session
const PUBLIC_ROUTES = ["/sign-in", "/api/auth/login", "/api/auth/logout"];

// Next.js internals and static assets — always bypass
const BYPASS_PREFIXES = ["/_next", "/favicon", "/public", "/icons", "/images"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip Next.js internals and static assets
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // 2. Check if this is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  );

  const sessionCookie = request.cookies.get(SA_COOKIE_NAME);
  const hasSession = Boolean(sessionCookie?.value);

  if (isPublicRoute) {
    // Already logged in and visiting sign-in → redirect to dashboard
    if (hasSession && pathname.startsWith("/sign-in")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 3. Protected route: no session → redirect to sign-in before ANY rendering
  if (!hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 4. Has session → allow through.
  // API routes do full JWT signature verification via getSASession() / verifySAToken().
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
