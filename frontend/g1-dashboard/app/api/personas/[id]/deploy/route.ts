import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

const PERSONA_FILE_PATH = '/home/jai/g1-universe/g1-nlp/config/persona.json';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // 1. Fetch the persona
    const personaToDeploy = await prisma.persona.findUnique({
      where: { id }
    });

    if (!personaToDeploy) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // 2. Set all other personas to inactive
    await prisma.persona.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // 3. Set this one to active and mark it as synced
    await prisma.persona.update({
      where: { id },
      data: {
        isActive: true,
        syncStatus: 'synced',
        lastSyncedAt: new Date()
      }
    });

    // 4. Create a version snapshot
    await prisma.personaVersion.create({
      data: {
        personaId: personaToDeploy.id,
        version: personaToDeploy.version,
        snapshot: personaToDeploy,
        changeSummary: 'Deployed to Robot',
        syncedToRobot: true,
        syncedAt: new Date()
      }
    });

    // 5. Write to JSON File
    const dir = path.dirname(PERSONA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePayload = {
      identity: {
        name: personaToDeploy.robotName,
        company: personaToDeploy.robotCompany,
        location: personaToDeploy.robotLocation,
        role: personaToDeploy.robotRole
      },
      system_prompt: personaToDeploy.systemPrompt,
      conversation_rules: personaToDeploy.conversationRules
    };

    fs.writeFileSync(PERSONA_FILE_PATH, JSON.stringify(filePayload, null, 2), 'utf-8');

    // 6. Push to live robot
    const ROBOT_SYNC_URL = process.env.ROBOT_SYNC_URL || 'http://192.168.1.61:9000';
    let robotSynced = false;
    try {
      const res = await fetch(`${ROBOT_SYNC_URL}/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filePayload),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) robotSynced = true;
    } catch (e) {
      console.warn('Robot unreachable during deploy:', e);
    }

    return NextResponse.json({ success: true, robotSynced });
  } catch (error) {
    console.error('Failed to deploy persona:', error);
    return NextResponse.json({ error: 'Failed to deploy' }, { status: 500 });
  }
}
