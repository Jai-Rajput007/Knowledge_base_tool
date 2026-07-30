import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSAToken, createSACookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { email, password } = data;

    if (!email || !password) {
      return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
    }

    // 1. Check Master Admin Credentials from .env
    const masterEmail = process.env.MASTER_ADMIN_EMAIL;
    const masterPassword = process.env.MASTER_ADMIN_PASSWORD;

    if (masterEmail && masterPassword && email === masterEmail && password === masterPassword) {
      const token = await createSAToken({
        sub: "master-admin",
        email: masterEmail,
        name: "Master Admin",
        role: "SUPER_ADMIN",
      });

      const response = NextResponse.json({
        success: true,
        user: { name: "Master Admin", role: "SUPER_ADMIN", email: masterEmail },
      });

      response.headers.set("Set-Cookie", createSACookieHeader(token));
      return response;
    }

    // 2. Look up admin from DB (for additional super admins created later)
    const admin = await prisma.superAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }

    // Verify password using bcrypt
    const passwordValid = await bcrypt.compare(password, admin.password);
    if (!passwordValid) {
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }

    // Issue a real signed JWT stored as HttpOnly cookie
    const token = await createSAToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    const response = NextResponse.json({
      success: true,
      user: { name: admin.name, role: admin.role, email: admin.email },
    });

    // Set HttpOnly cookie — not accessible to JavaScript in the browser
    response.headers.set("Set-Cookie", createSACookieHeader(token));

    return response;
  } catch (error) {
    console.error("[SA Auth] Login failed:", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
