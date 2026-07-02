import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { publishAuthSync } from '@/lib/mqtt';
import type { UserRole } from '@/lib/mock-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Verify current user session
    const cookieStore = await cookies();
    const token = cookieStore.get('g1_session')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user in local DB
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check old password (supporting both plaintext seeded data and bcrypt hashes)
    const isMatch = user.password.startsWith('$2') 
      ? await bcrypt.compare(oldPassword, user.password)
      : user.password === oldPassword;

    if (!isMatch) {
      return NextResponse.json({ error: 'Incorrect old password' }, { status: 400 });
    }

    // Hash new password and update local DB
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: newPasswordHash,
        requiresPasswordChange: false 
      }
    });

    // Reissue token with requiresPasswordChange: false
    const newToken = await createToken({
      ...payload,
      requiresPasswordChange: false,
      role: user.role.toLowerCase() as UserRole, // ensure correct typing
    });

    cookieStore.set({
      name: 'g1_session',
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    // Publish sync to Super Admin via MQTT (IoT Simulator)
    if (user.tenantId) {
      publishAuthSync(user.tenantId, user.id, newPasswordHash);
    }

    return NextResponse.json({ success: true, redirectTo: '/dashboard' });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
