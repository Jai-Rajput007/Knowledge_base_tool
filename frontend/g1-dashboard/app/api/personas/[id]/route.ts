import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Check if it's a template
    const persona = await prisma.persona.findUnique({ where: { id } });
    if (persona?.isTemplate) {
      return NextResponse.json({ error: 'Cannot delete a pre-built template' }, { status: 403 });
    }

    if (persona?.isActive) {
      return NextResponse.json({ error: 'Cannot delete the currently active persona' }, { status: 403 });
    }

    await prisma.persona.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();
    const rules = Array.isArray(data.conversation_rules) ? data.conversation_rules : [];

    const updated = await prisma.persona.update({
      where: { id },
      data: {
        name: data.name,
        robotName: data.identity?.name,
        robotCompany: data.identity?.company,
        robotLocation: data.identity?.location,
        robotRole: data.identity?.role,
        systemPrompt: data.system_prompt,
        conversationRules: rules,
        version: { increment: 1 }
      }
    });

    return NextResponse.json({ success: true, persona: updated });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 });
  }
}
