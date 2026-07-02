import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('g1_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    return NextResponse.json({
      id: session.sub,
      email: session.email,
      name: session.name,
      role: session.role,
      requiresPasswordChange: session.requiresPasswordChange,
      tenantId: session.tenantId,
      tenantName: session.tenantName,
    });
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
}
