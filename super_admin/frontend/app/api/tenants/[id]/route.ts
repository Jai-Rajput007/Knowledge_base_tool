import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.id }
    });
    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Failed to fetch tenant:", error);
    return NextResponse.json({ error: "Failed to fetch tenant" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const data = await request.json();
    const updatedTenant = await prisma.tenant.update({
      where: { id: params.id },
      data: {
        name: data.name,
        host: data.host,
        companyDescription: data.companyDescription,
        companyType: data.companyType,
        companyLogo: data.companyLogo,
        features: data.features
      }
    });
    return NextResponse.json(updatedTenant);
  } catch (error) {
    console.error("Failed to update tenant:", error);
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    await prisma.tenant.delete({
      where: { id: params.id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tenant:", error);
    return NextResponse.json({ error: "Failed to delete tenant" }, { status: 500 });
  }
}
