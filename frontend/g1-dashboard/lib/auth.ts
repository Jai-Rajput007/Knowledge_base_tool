import { V3 } from 'paseto';
import { createSecretKey } from 'crypto';
import { cookies } from 'next/headers';
import type { UserRole } from '@/lib/mock-db';

const COOKIE_NAME = 'g1_session';
const TOKEN_EXPIRY = '8h';

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  requiresPasswordChange: boolean;
  tenantId?: string;
  tenantName?: string;
}

function getSecretKey() {
  const hex = process.env.PASETO_SECRET_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('PASETO_SECRET_KEY must be a 64-character hex string (32 bytes)');
  }
  return createSecretKey(Buffer.from(hex, 'hex'));
}

/**
 * Encrypt a PASETO v3.local token with user data.
 * The entire payload is encrypted — no one can read it without the secret key.
 * Uses XChaCha20-Poly1305 for authenticated encryption.
 */
export async function createToken(payload: TokenPayload): Promise<string> {
  const key = getSecretKey();
  return V3.encrypt({ ...payload }, key, {
    expiresIn: TOKEN_EXPIRY,
    iat: true,
  });
}

/**
 * Decrypt and verify a PASETO v3.local token.
 * Returns the payload if valid, null if expired/tampered/invalid.
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const key = getSecretKey();
    // V3.decrypt returns the payload directly (not wrapped in { payload })
    const result = await V3.decrypt(token, key);
    return result as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Read the session cookie and verify the PASETO token.
 * For use in Server Components and API routes.
 */
export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return null;
  return verifyToken(sessionCookie.value);
}

/**
 * Returns headers to set the session cookie.
 */
export function createSessionCookie(token: string): string {
  const maxAge = 8 * 60 * 60; // 8 hours
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * Returns headers to clear the session cookie.
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export { COOKIE_NAME };
