import { getSession } from '@/lib/auth';
import type { UserRole } from '@/lib/mock-db';

export type { UserRole };

/**
 * Get the current user's role from the encrypted PASETO session token.
 * Returns null if no valid session exists.
 */
export async function getUserRole(): Promise<UserRole | null> {
  const session = await getSession();
  return session?.role ?? null;
}

/**
 * Get the full session data for server components.
 */
export async function getUserSession() {
  return getSession();
}

export async function isSuperAdmin(): Promise<boolean> {
  return (await getUserRole()) === 'super_admin';
}

export async function isClient(): Promise<boolean> {
  return (await getUserRole()) === 'client';
}

export async function isViewer(): Promise<boolean> {
  return (await getUserRole()) === 'viewer';
}
