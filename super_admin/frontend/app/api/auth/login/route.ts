import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (data.email === "super@admin.com" && data.password === "admin123") {
        return NextResponse.json({ 
            token: "dev_super_admin_token", 
            user: { name: "Super Admin", role: "SUPER_ADMIN", email: data.email } 
        });
    }
    
    const admin = await prisma.superAdmin.findUnique({
        where: { email: data.email }
    });
    
    if (!admin || admin.password !== data.password) {
        return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }
        
    return NextResponse.json({ 
        token: `token_${admin.id}`, 
        user: { name: admin.name, role: admin.role, email: admin.email } 
    });
  } catch (error) {
    console.error("Failed to login:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
