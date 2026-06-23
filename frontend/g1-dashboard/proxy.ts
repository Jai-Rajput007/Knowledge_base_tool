import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'g1_session';

/**
 * Lightweight middleware that acts as a first-line gate.
 * 
 * Security Model (Defense in Depth):
 * - Layer 1 (this middleware): Checks if the session cookie EXISTS.
 *   Runs on Edge runtime, so we cannot decrypt the PASETO token here.
 * - Layer 2 (server component layouts): Decrypts and verifies the PASETO
 *   token, checks the role, and enforces RBAC. This runs on Node.js runtime.
 *
 * Even if someone adds a fake cookie to bypass this middleware,
 * the server components will fail to decrypt it and redirect to /sign-in.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(COOKIE_NAME);

  // Public routes that don't need auth (but shouldn't be accessed if already logged in)
  const isPublicRoute =
    pathname === '/sign-in' ||
    (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/logout');

  // If accessing a public route (like sign-in or login API) while already authenticated, redirect to home
  if (isPublicRoute && sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If accessing a protected route without a session cookie, redirect to sign-in
  if (!isPublicRoute && !sessionCookie?.value) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
