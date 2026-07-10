import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishFeatureUpdate } from "@/lib/mqtt";

// Canonical list of all platform features — single source of truth
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
  frs: false,
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id }
    });
    
    // Merge stored features with canonical list so new features always appear
    const storedFeatures = tenant?.features ? JSON.parse(tenant.features) : {};
    const mergedFeatures = { ...CANONICAL_FEATURES, ...storedFeatures };
    
    // Only keep canonical keys (strip any legacy keys like ragChat, documentUpload, etc.)
    const cleanFeatures: Record<string, boolean> = {};
    for (const key of Object.keys(CANONICAL_FEATURES)) {
      cleanFeatures[key] = mergedFeatures[key] ?? false;
    }
    
    return NextResponse.json(cleanFeatures);
  } catch (error) {
    console.error("Failed to fetch features:", error);
    return NextResponse.json({ error: "Failed to fetch features" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const data = await request.json();
    await prisma.tenant.update({
      where: { id: params.id },
      data: {
        features: JSON.stringify(data)
      }
    });
    
    // Publish MQTT update to local IoT simulator
    await publishFeatureUpdate(params.id, data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update features:", error);
    return NextResponse.json({ error: "Failed to update features" }, { status: 500 });
  }
}
