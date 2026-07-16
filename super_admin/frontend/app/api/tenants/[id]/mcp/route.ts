import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishMcpUpdate } from "@/lib/mqtt";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const configs = await prisma.tenantMcpConfig.findMany({
      where: { tenantId: params.id }
    });
    
    const available_mcps = [
        { id: "composio", name: "Composio Hub", provider: "composio", tier: "PRO", isUnlocked: false },
        { id: "linear", name: "Linear Issues", provider: "linear", tier: "PRO", isUnlocked: false },
    ];
    
    const unlockedMap: Record<string, boolean> = {};
    configs.forEach((c: any) => {
        unlockedMap[c.mcpId] = c.isUnlocked;
    });
    
    available_mcps.forEach(m => {
        if (unlockedMap[m.id] !== undefined) {
            m.isUnlocked = unlockedMap[m.id];
        }
    });
            
    return NextResponse.json(available_mcps);
  } catch (error) {
    console.error("Failed to fetch MCPs:", error);
    return NextResponse.json({ error: "Failed to fetch MCPs" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const data = await request.json(); // expects { mcpId: string, isUnlocked: boolean }
    
    const config = await prisma.tenantMcpConfig.findFirst({
        where: { tenantId: params.id, mcpId: data.mcpId }
    });
    
    if (config) {
        await prisma.tenantMcpConfig.update({
            where: { id: config.id },
            data: { isUnlocked: data.isUnlocked }
        });
    } else {
        await prisma.tenantMcpConfig.create({
            data: {
                tenantId: params.id,
                mcpId: data.mcpId,
                isUnlocked: data.isUnlocked
            }
        });
    }

    // Publish MQTT update to local IoT simulator
    publishMcpUpdate(params.id, { mcpId: data.mcpId, isUnlocked: data.isUnlocked });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to toggle MCP:", error);
    return NextResponse.json({ error: "Failed to toggle MCP" }, { status: 500 });
  }
}
