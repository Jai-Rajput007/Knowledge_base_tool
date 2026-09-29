import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createToken } from '@/lib/auth';
import type { UserRole } from '@/lib/mock-db';
import { IS_DEMO, DEMO_USER, DEMO_SESSION_TOKEN, DEMO_ACCESS_TOKEN } from '@/lib/demo/config';

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

    // Demo deployment: a single demo account, no backend.
    if (IS_DEMO) {
      const ok =
        String(email).trim().toLowerCase() === DEMO_USER.email && password === DEMO_USER.password;
      if (!ok) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
      const cookieStore = await cookies();
      cookieStore.set({
        name: 'g1_session',
        value: DEMO_SESSION_TOKEN,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60,
      });
      return NextResponse.json({
        success: true,
        redirectTo: '/dashboard',
        access_token: DEMO_ACCESS_TOKEN,
        user: { id: DEMO_USER.id, name: DEMO_USER.name, email: DEMO_USER.email, role: DEMO_USER.role },
      });
    }

    // Proxy to FastAPI backend
    // Route handler runs on the server: absolute URL required, so this uses the
    // server-only BACKEND_INTERNAL_URL (NEXT_PUBLIC_API_URL is now relative).
    const apiRes = await fetch((process.env.BACKEND_INTERNAL_URL || "http://localhost:8000/api/v1") + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });

    if (!apiRes.ok) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const data = await apiRes.json();
    const user = data.user;

    // Create encrypted PASETO token
    const roleString = user.role.toLowerCase() as UserRole;

    const token = await createToken({
      sub: user.id.toString(),
      email: user.email,
      name: user.username,
      role: roleString,
      requiresPasswordChange: user.requires_password_change === 1,
      tenantId: user.tenant_id,
      tenantName: user.tenant_name || "Default Tenant",
    });

    // Determine redirect
    const redirectTo = '/dashboard'; 

    // Set HttpOnly cookie via next/headers
    const cookieStore = await cookies();
    cookieStore.set({
      name: 'g1_session',
      value: token,
      httpOnly: true,
      secure: false, // Access is over local network HTTP (192.168.x.x) so Secure must be false
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return NextResponse.json(
      {
        success: true,
        redirectTo,
        access_token: data.access_token,
        user: {
          id: user.id,
          name: user.username,
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
