import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { UserRole } from '@/lib/mock-db';

export async function PUT(request: NextRequest) {
  try {
    // Verify current user session
    const cookieStore = await cookies();
    const token = cookieStore.get('g1_session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reissue token with requiresPasswordChange: false
    const newToken = await createToken({
      ...payload,
      requiresPasswordChange: false,
      role: payload.role as UserRole, // ensure correct typing
    });

    cookieStore.set({
      name: 'g1_session',
      value: newToken,
      httpOnly: true,
      secure: false, // Access is over local network HTTP (192.168.x.x)
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return NextResponse.json({ success: true, redirectTo: '/dashboard' });
  } catch (err) {
    console.error('Change password cookie sync error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
