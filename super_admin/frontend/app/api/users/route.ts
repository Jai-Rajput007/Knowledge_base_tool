import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { publishUserSync } from '@/lib/mqtt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, email, name, password, role = "CLIENT" } = body;

    if (!tenantId || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure tenant exists (for testing purposes)
    const tenant = await prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: {
        id: tenantId,
        name: "Test Tenant (Stark Industries)"
      }
    });

    // Hash the "First Password"
    const passwordHash = await bcrypt.hash(password, 10);

    // Save to Super Admin Cloud DB (using upsert so tests can be run multiple times)
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: passwordHash,
        requiresPasswordChange: true
      },
      create: {
        tenantId,
        email,
        name,
        password: passwordHash,
        role,
        requiresPasswordChange: true
      }
    });

    // Publish downstream to AGX Robot (IoT Simulator)
    publishUserSync(tenantId, {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      password: user.password,
      role: user.role,
      requiresPasswordChange: user.requiresPasswordChange
    });

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Failed to create user:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
