import { NextResponse } from "next/server";

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1") + "/tenant";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${BACKEND_URL}/tickets`, { 
      cache: 'no-store',
      headers: { "Authorization": authHeader },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const tickets = await res.json();
    return NextResponse.json({ tickets });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get("Authorization") || "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${BACKEND_URL}/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error("Failed to create ticket");
    }
    
    const ticket = await res.json();
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
