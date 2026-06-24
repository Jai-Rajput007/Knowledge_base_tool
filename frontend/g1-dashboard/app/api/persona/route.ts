import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

const PERSONA_FILE_PATH = '/home/jai/g1-universe/g1-nlp/config/persona.json';

export async function GET() {
  try {
    // 1. Try to fetch the active persona from the database
    let activePersona = await prisma.persona.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    // 2. If it doesn't exist in DB yet, try to read from the JSON file to bootstrap
    if (!activePersona) {
      if (fs.existsSync(PERSONA_FILE_PATH)) {
        const fileData = fs.readFileSync(PERSONA_FILE_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(fileData));
      } else {
        return NextResponse.json({ error: 'No persona found' }, { status: 404 });
      }
    }

    // 3. Format the DB model to match the JSON structure expected by the UI and Python
    const formattedData = {
      identity: {
        name: activePersona.robotName,
        company: activePersona.robotCompany,
        location: activePersona.robotLocation,
        role: activePersona.robotRole
      },
      system_prompt: activePersona.systemPrompt,
      conversation_rules: activePersona.conversationRules,
      // Pass the DB ID so the frontend can send it back on POST
      _db_id: activePersona.id,
      _version: activePersona.version
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Failed to read persona:', error);
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // 1. Write to PostgreSQL Database (Source of Truth)
    const rules = Array.isArray(data.conversation_rules) ? data.conversation_rules : [];
    
    let dbPersona;
    
    // Check if we already have an active persona in DB
    const existingActive = await prisma.persona.findFirst({
      where: { isActive: true }
    });

    if (existingActive) {
      // Update existing
      dbPersona = await prisma.persona.update({
        where: { id: existingActive.id },
        data: {
          robotName: data.identity?.name || '',
          robotCompany: data.identity?.company || '',
          robotLocation: data.identity?.location || '',
          robotRole: data.identity?.role || '',
          systemPrompt: data.system_prompt || '',
          conversationRules: rules,
          version: { increment: 1 },
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        }
      });
    } else {
      // Create new
      dbPersona = await prisma.persona.create({
        data: {
          name: 'Main Robot Persona',
          robotName: data.identity?.name || 'Jarvis',
          robotCompany: data.identity?.company || '',
          robotLocation: data.identity?.location || '',
          robotRole: data.identity?.role || '',
          systemPrompt: data.system_prompt || '',
          conversationRules: rules,
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        }
      });
    }

    // 2. Create a Snapshot Version in DB for rollback
    await prisma.personaVersion.create({
      data: {
        personaId: dbPersona.id,
        version: dbPersona.version,
        snapshot: data,
        changeSummary: 'Updated via Persona Manager UI',
        syncedToRobot: true,
        syncedAt: new Date()
      }
    });

    // 3. Write to JSON File (High-Speed Cache for Python Robot)
    const dir = path.dirname(PERSONA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the exact data the python script expects
    const filePayload = {
      identity: data.identity,
      system_prompt: data.system_prompt,
      conversation_rules: rules
    };

    fs.writeFileSync(PERSONA_FILE_PATH, JSON.stringify(filePayload, null, 2), 'utf-8');

    return NextResponse.json({ success: true, version: dbPersona.version });
  } catch (error) {
    console.error('Failed to write persona config:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
