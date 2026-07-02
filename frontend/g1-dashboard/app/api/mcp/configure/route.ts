import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { mcpId, isEnabled, credentials } = await req.json();

    // 1. Get the first tenant (acting as the current logged-in tenant)
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 400 });
    }

    // 2. Fetch the MCP integration
    const integration = await prisma.mcpIntegration.findUnique({
      where: { id: mcpId }
    });
    
    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // 3. Upsert the configuration
    // (If this was production, we would encrypt the credentials here)
    const config = await prisma.tenantMcpConfig.upsert({
      where: {
        tenantId_mcpId: {
          tenantId: tenant.id,
          mcpId: mcpId,
        }
      },
      update: {
        isEnabled,
        ...(credentials ? { credentials: JSON.stringify(credentials) } : {})
      },
      create: {
        tenantId: tenant.id,
        mcpId: mcpId,
        isUnlocked: integration.tier === 'BASIC',
        isEnabled,
        credentials: credentials ? JSON.stringify(credentials) : "{}"
      }
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to update MCP config', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
