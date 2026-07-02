import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Get all available integrations
    const integrations = await prisma.mcpIntegration.findMany({
      orderBy: { category: 'asc' }
    });

    // 2. Get the first tenant (acting as the current logged-in tenant for this prototype)
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: 'Default Tenant' } });
    }

    // 3. Get all configs for this tenant
    const tenantConfigs = await prisma.tenantMcpConfig.findMany({
      where: { tenantId: tenant.id }
    });

    // 4. Merge them together for the frontend
    const payload = integrations.map(integration => {
      const config = tenantConfigs.find(c => c.mcpId === integration.id);
      
      return {
        ...integration,
        // Basic tools are always unlocked. Pro tools depend on the database state.
        isUnlocked: integration.tier === 'BASIC' ? true : (config?.isUnlocked || false),
        isEnabled: config?.isEnabled || false,
        configId: config?.id || null,
        // Omit credentials, the frontend doesn't need to see them
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to fetch MCP integrations', error);
    return NextResponse.json({ error: 'Failed to fetch MCP integrations' }, { status: 500 });
  }
}
