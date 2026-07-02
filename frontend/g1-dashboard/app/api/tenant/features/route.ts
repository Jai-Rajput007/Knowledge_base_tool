import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Canonical list — all features default to false if not found in DB
const CANONICAL_FEATURES: Record<string, boolean> = {
  personaChange: false,
  prebuiltPersonas: false,
  generativePersona: false,
  mcp: false,
  wakeWordSettings: false,
  voiceSettings: false,
  chatSimulator: false,
  rag: false,
  rbac: false,
  configurationGestures: false,
  rollback: false,
  auditing: false,
  multilingual: false,
  skillLibrary: false,
  webhook: false,
  healthStats: false,
  otaUpdates: false,
  emotions: false,
  communicationGestures: false,
  navigation: false,
  featureSuggestions: false,
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('g1_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: 'Invalid session or no tenant' }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { features: true },
    });

    const storedFeatures = tenant?.features ? JSON.parse(tenant.features) : {};

    // Merge stored features into canonical list — only canonical keys are returned
    const cleanFeatures: Record<string, boolean> = {};
    for (const key of Object.keys(CANONICAL_FEATURES)) {
      cleanFeatures[key] = storedFeatures[key] === true;
    }

    return NextResponse.json(cleanFeatures);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 });
  }
}
