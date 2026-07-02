import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createToken } from '@/lib/auth';
import type { UserRole } from '@/lib/mock-db';
import bcrypt from 'bcryptjs';

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

    // Find user in local Prisma database
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

    // Check password (supporting both plaintext seeded data and bcrypt hashes)
    const isMatch = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create encrypted PASETO token
    const roleString = user.role.toLowerCase() as UserRole;

    const token = await createToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: roleString,
      requiresPasswordChange: user.requiresPasswordChange,
      tenantId: user.tenant?.id,
      tenantName: user.tenant?.name,
    });

    // Determine redirect
    const redirectTo = user.requiresPasswordChange ? '/change-password' : '/dashboard'; 

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
