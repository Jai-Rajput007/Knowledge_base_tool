import { NextRequest, NextResponse } from "next/server";

/**
 * Super Admin Proxy (formerly middleware.ts — renamed per Next.js 16+ convention)
 * Auth DISABLED. All routes pass through freely.
 * MQTT publishing still works through API routes independently.
 */
export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
