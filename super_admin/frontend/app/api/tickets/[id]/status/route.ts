import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishTicketStatus } from "@/lib/mqtt";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!status || !["OPEN", "UNDER REVIEW", "RESOLVED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { status }
    });

    // Publish to MQTT using the singleton
    await publishTicketStatus(ticket.tenantId, ticket.id, ticket.status);

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}
