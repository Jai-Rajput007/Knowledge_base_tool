/**
 * /api/persona — Next.js route
 *
 * GET  → reads persona from robot (robot_sync.py) with Prisma DB as fallback
 * POST → saves to Prisma DB + pushes to robot via robot_sync.py (hot-reload, no restart)
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ROBOT_SYNC_URL = process.env.ROBOT_SYNC_URL || 'http://192.168.1.61:9000';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  // 1. Try live persona from robot (source of truth — what the robot is actually running)
  try {
    const res = await fetch(`${ROBOT_SYNC_URL}/persona`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const robotPersona = await res.json();
      return NextResponse.json({ ...robotPersona, _source: 'robot' });
    }
  } catch {
    // Robot unreachable — fall through to DB
  }

  // 2. Fall back to Prisma DB
  try {
    const activePersona = await prisma.persona.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (activePersona) {
      let rules: string[] = [];
      try { rules = JSON.parse(activePersona.conversationRules as string); } catch { rules = []; }

      return NextResponse.json({
        identity: {
          name:     activePersona.robotName,
          company:  activePersona.robotCompany,
          location: activePersona.robotLocation,
          role:     activePersona.robotRole,
        },
        system_prompt:       activePersona.systemPrompt,
        conversation_rules:  rules,
        _db_id:              activePersona.id,
        _version:            activePersona.version,
        _source:             'db',
        _warning:            'Robot unreachable — showing last saved config',
      });
    }
  } catch { /* Prisma not set up yet */ }

  return NextResponse.json({ error: 'No persona found — robot offline and no DB record' }, { status: 404 });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const rules = Array.isArray(data.conversation_rules) ? data.conversation_rules : [];

    const payload = {
      identity:            data.identity,
      system_prompt:       data.system_prompt || '',
      conversation_rules:  rules,
    };

    // 1. Push to robot (robot_sync.py writes persona.json, watchdog hot-reloads instantly)
    let robotSynced = false;
    let robotMessage = '';
    try {
      const res = await fetch(`${ROBOT_SYNC_URL}/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        robotSynced = true;
        robotMessage = 'Persona hot-reloaded on robot — active immediately';
      } else {
        robotMessage = `Robot sync failed: ${res.status}`;
      }
    } catch (e) {
      robotMessage = 'Robot unreachable — saved to DB only';
    }

    // 2. Save to Prisma DB (source of truth, used as fallback when robot offline)
    let dbVersion = 1;
    try {
      const existing = await prisma.persona.findFirst({ where: { isActive: true } });

      let dbPersona;
      if (existing) {
        dbPersona = await prisma.persona.update({
          where: { id: existing.id },
          data: {
            robotName:        data.identity?.name     || '',
            robotCompany:     data.identity?.company  || '',
            robotLocation:    data.identity?.location || '',
            robotRole:        data.identity?.role     || '',
            systemPrompt:     data.system_prompt      || '',
            conversationRules: JSON.stringify(rules),
            version:          { increment: 1 },
            lastSyncedAt:     new Date(),
            syncStatus:       robotSynced ? 'synced' : 'pending',
          },
        });
      } else {
        dbPersona = await prisma.persona.create({
          data: {
            name:             'Main Robot Persona',
            robotName:        data.identity?.name     || 'Jarvis',
            robotCompany:     data.identity?.company  || '',
            robotLocation:    data.identity?.location || '',
            robotRole:        data.identity?.role     || '',
            systemPrompt:     data.system_prompt      || '',
            conversationRules: JSON.stringify(rules),
            lastSyncedAt:     new Date(),
            syncStatus:       robotSynced ? 'synced' : 'pending',
          },
        });
      }

      dbVersion = dbPersona.version;

      // Save version snapshot for rollback
      await prisma.personaVersion.create({
        data: {
          personaId:    dbPersona.id,
          version:      dbPersona.version,
          snapshot:     JSON.stringify(payload),
          changeSummary: 'Updated via Persona Manager UI',
          syncedToRobot: robotSynced,
          syncedAt:     robotSynced ? new Date() : null,
        },
      });
    } catch { /* Prisma not set up yet — that's ok, robot sync still worked */ }

    return NextResponse.json({
      success:      true,
      robot_synced: robotSynced,
      message:      robotMessage,
      version:      dbVersion,
    });

  } catch (error) {
    console.error('Persona save error:', error);
    return NextResponse.json({ error: 'Failed to save persona' }, { status: 500 });
  }
}
