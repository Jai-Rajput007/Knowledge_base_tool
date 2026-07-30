import { NextRequest, NextResponse } from "next/server";

/**
 * Super Admin Proxy (Next.js 16+ convention — replaces middleware.ts)
 * Auth DISABLED. All routes pass through freely.
 * MQTT publishing still works through API routes independently.
 */
export async function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
