import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUserByEmail, validatePassword } from '@/lib/mock-db';
import { createToken, createSessionCookie } from '@/lib/auth';

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

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      // Generic error to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Validate password
    if (!validatePassword(user, password)) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create encrypted PASETO token
    const token = await createToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
    });

    // Determine redirect based on role
    let redirectTo = '/client-dashboard';
    if (user.role === 'super_admin') {
      redirectTo = '/super-admin';
    } else if (user.role === 'viewer') {
      redirectTo = '/client-dashboard';
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

    const response = NextResponse.json(
      {
        success: true,
        redirectTo,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
