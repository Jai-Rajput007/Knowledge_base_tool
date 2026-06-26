import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const personas = await prisma.persona.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return NextResponse.json(personas);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const rules = Array.isArray(data.conversation_rules) ? data.conversation_rules : [];
    
    // Create new
    const dbPersona = await prisma.persona.create({
      data: {
        name: data.name || 'Custom Persona',
        robotName: data.identity?.name || '',
        robotCompany: data.identity?.company || '',
        robotLocation: data.identity?.location || '',
        robotRole: data.identity?.role || '',
        systemPrompt: data.system_prompt || '',
        conversationRules: rules,
        isActive: false, // Not active until deployed
        syncStatus: 'not_synced'
      }
    });

    return NextResponse.json({ success: true, persona: dbPersona });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
  }
}
