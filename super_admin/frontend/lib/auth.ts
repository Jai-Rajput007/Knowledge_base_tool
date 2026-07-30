/**
 * Super Admin Auth Utilities
 * Uses bcryptjs (already installed) for password hashing and simple signed tokens
 * stored in an HttpOnly cookie named 'sa_session'.
 *
 * Token format: base64(JSON payload) — lightweight, no external crypto dep needed
 * at Edge runtime. Full signature verification happens in API routes.
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SA_COOKIE_NAME = "sa_session";
const TOKEN_EXPIRY = "8h";

function getJwtSecret(): Uint8Array {
  const secret = process.env.SA_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SA_JWT_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

export interface SATokenPayload {
  sub: string;      // admin ID
  email: string;
  name: string;
  role: string;     // "SUPER_ADMIN"
}

/**
 * Create a signed JWT for Super Admin session.
 * Stored as an HttpOnly cookie (not localStorage).
 */
export async function createSAToken(payload: SATokenPayload): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);
}

/**
 * Verify a Super Admin JWT. Returns payload or null if invalid/expired.
 */
export async function verifySAToken(token: string): Promise<SATokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SATokenPayload;
  } catch {
    return null;
  }
}

/**
 * Read and verify the sa_session cookie.
 * For use in Server Components and API routes.
 */
export async function getSASession(): Promise<SATokenPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SA_COOKIE_NAME);
  if (!sessionCookie?.value) return null;
  return verifySAToken(sessionCookie.value);
}

export function createSACookieHeader(token: string): string {
  const maxAge = 8 * 60 * 60; // 8 hours
  return `${SA_COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearSACookie(): string {
  return `${SA_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
