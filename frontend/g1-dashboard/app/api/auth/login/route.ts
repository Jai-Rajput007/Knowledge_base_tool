import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import type { UserRole } from '@/lib/mock-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user in Prisma database
    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Validate password (raw string match for our seeded demo users, add bcrypt later)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create encrypted PASETO token
    // Lowercase the Prisma Enum role so it matches our existing UI logic (e.g. SUPER_ADMIN -> super_admin)
    const roleString = user.role.toLowerCase() as UserRole;

    const token = await createToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: roleString,
      tenantId: user.tenantId || undefined,
      tenantName: user.tenant?.name || undefined,
    });

    // Determine redirect based on role
    // Instead of the old client-dashboard placeholder, send them to the new RAG dashboard
    let redirectTo = '/dashboard'; 
    if (roleString === 'super_admin') {
      redirectTo = '/super-admin';
    }

    // Set HttpOnly cookie via next/headers
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'g1_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return NextResponse.json(
      {
        success: true,
        redirectTo,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: roleString,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
