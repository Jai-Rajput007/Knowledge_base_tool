/**
 * Mock User Database
 * 
 * In production, replace this with a real database (Prisma + PostgreSQL, etc.)
 * Passwords here are stored in plain text for development purposes ONLY.
 * In production, ALWAYS use bcrypt or argon2 for password hashing.
 */

export type UserRole = 'super_admin' | 'client' | 'viewer';

export interface MockUser {
  id: string;
  email: string;
  password: string; // Plain text for mock only!
  name: string;
  role: UserRole;
  tenantId?: string;
  tenantName?: string;
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'usr_sa_001',
    email: 'admin@g1platform.com',
    password: 'Admin@123',
    name: 'Platform Admin',
    role: 'super_admin',
  },
  {
    id: 'usr_cl_001',
    email: 'client@g1universe.com',
    password: 'Client@123',
    name: 'Sarah Chen',
    role: 'client',
    tenantId: 'ten_001',
    tenantName: 'G1 Universe',
  },
  {
    id: 'usr_vw_001',
    email: 'viewer@g1universe.com',
    password: 'Viewer@123',
    name: 'Alex Rivera',
    role: 'viewer',
    tenantId: 'ten_001',
    tenantName: 'G1 Universe',
  },
];

export function findUserByEmail(email: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function validatePassword(user: MockUser, password: string): boolean {
  // In production: use bcrypt.compare(password, user.hashedPassword)
  return user.password === password;
}
