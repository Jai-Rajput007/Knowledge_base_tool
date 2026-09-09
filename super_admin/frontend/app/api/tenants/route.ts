import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from 'bcryptjs';
import { publishUserSync, publishTenantSync } from '@/lib/mqtt';

export async function GET() {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { users: true }
    });
    return NextResponse.json(tenants);
  } catch (error) {
    console.error("Failed to fetch tenants:", error);
    return NextResponse.json({ error: "Failed to fetch tenants" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Check if the user email already exists
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "A user with this email already exists. Please use a unique email." },
          { status: 400 }
        );
      }
    }

    // Generate secure random password
    const crypto = require('crypto');
    const rawPassword = `G1-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    
    const newTenant = await prisma.tenant.create({
        data: {
          name: data.name,
          host: data.host,
          hostEmail: data.email,
          companyDescription: data.companyDescription,
          companyType: data.companyType,
          companyLogo: data.companyLogo,
          plan: data.plan || "Starter",
          features: JSON.stringify({
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
            internationalLanguage: false,
            skillLibrary: false,
            webhook: false,
            healthStats: false,
            otaUpdates: false,
            emotions: false,
            communicationGestures: false,
            navigation: false,
            featureSuggestions: false,
            frs: false
          })
        }
    });

    const newUser = await prisma.user.create({
        data: {
            tenantId: newTenant.id,
            email: data.email,
            password: passwordHash,
            name: data.host || data.name,
            role: "CLIENT",
            requiresPasswordChange: true
        }
    });

    // Publish downstream to AGX Robot (IoT Simulator)
    publishUserSync(newTenant.id, {
      id: newUser.id,
      tenantId: newUser.tenantId,
      email: newUser.email,
      name: newUser.name,
      password: newUser.password,
      role: newUser.role,
      requiresPasswordChange: newUser.requiresPasswordChange
    });

    publishTenantSync(newTenant.id, {
      id: newTenant.id,
      name: newTenant.name,
      host: newTenant.host,
      hostEmail: newTenant.hostEmail,
      companyDescription: newTenant.companyDescription,
      companyType: newTenant.companyType,
      companyLogo: newTenant.companyLogo,
    });

    await prisma.tenantMcpConfig.create({
        data: {
            tenantId: newTenant.id,
            mcpId: "composio",
            isUnlocked: false
        }
    });

    return NextResponse.json({ tenant: newTenant, user: newUser, password: rawPassword });
  } catch (error) {
    console.error("Failed to create tenant:", error);
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}
