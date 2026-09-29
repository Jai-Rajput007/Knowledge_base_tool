import { NextRequest, NextResponse } from "next/server";

// Cookie name must match lib/auth.ts
const SESSION_COOKIE = "g1_session";

// Routes that are publicly accessible (no auth required)
const PUBLIC_ROUTES = [
  "/sign-in", "/api/auth/login", "/api/auth/logout",
  // Demo deployment only: the simulated third-party OAuth consent page opens in a
  // new tab and must render even though it is outside the dashboard shell.
  ...(process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? ["/demo-oauth"] : []),
];

// Routes that should bypass middleware entirely (Next.js internals, static assets)
//
// "/api/v1" is the same-origin proxy to the FastAPI backend (see next.config.ts
// rewrites). It must bypass this middleware: without it, an API call made before
// a session cookie exists gets 307-redirected to /sign-in, so the caller receives
// an HTML redirect body instead of a JSON response or a clean 401. The backend
// enforces its own PASETO auth on every one of those routes, so skipping the
// cookie check here removes no protection — it only stops API replies from being
// rewritten into sign-in pages.
const BYPASS_PREFIXES = ["/_next", "/favicon", "/public", "/icons", "/images", "/api/v1"];

// Next.js serves everything in public/ from the ROOT (e.g. public/bg.mp4 -> /bg.mp4),
// never under a /public prefix — so BYPASS_PREFIXES above never actually matches any
// real static asset filename. Without this, a fresh unauthenticated request for any
// public/ file (video backgrounds, 3D scene binaries, etc.) got treated as a protected
// page and 307-redirected to /sign-in, feeding the requester an HTML redirect body
// instead of the real asset. Confirmed live: curl against /bg.mp4 and /scene.splinecode
// both returned 307s, which is why the sign-in video rendered blank and the landing
// page's Spline model crashed trying to parse a redirect page as binary scene data.
const STATIC_FILE_PATTERN =
  /\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|mp4|webm|mov|mp3|wav|ogg|css|map|woff2?|ttf|eot|json|splinecode|txt|pdf)$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always bypass for Next.js internals and any static file by extension
  if (
    BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    STATIC_FILE_PATTERN.test(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const hasSession = Boolean(sessionCookie?.value);

  // 2. Public route handling
  // "/" is the marketing landing page — public regardless of session, exact
  // match only (a startsWith check here would whitelist every route, since
  // every pathname begins with "/").
  const isPublicRoute =
    pathname === "/" ||
    PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route));

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
