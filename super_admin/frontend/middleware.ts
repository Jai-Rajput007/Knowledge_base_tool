import { NextRequest, NextResponse } from "next/server";

/**
 * Super Admin Middleware — Auth DISABLED.
 * All routes are publicly accessible. No session checks are performed.
 * MQTT publishing still works independently through API routes.
 */
export async function middleware(request: NextRequest) {
  // Pass every request through without any auth checks.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
