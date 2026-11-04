import { NextRequest, NextResponse } from "next/server";
import { createTicket } from "@/lib/tickets/ticket-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client, projectId, projectName, issue, photoUrl, raisedByName } = body;

    if (!client || !projectId || !issue) {
      return NextResponse.json(
        { error: "Client, Project, and Issue description are required" },
        { status: 400 }
      );
    }

    if (issue.trim().length < 5) {
      return NextResponse.json(
        { error: "Issue description must be at least 5 characters long" },
        { status: 400 }
      );
    }

    const ticket = await createTicket({
      client,
      projectId,
      projectName: projectName || projectId,
      issue,
      photoUrl,
      raisedByName,
    });

    return NextResponse.json({
      success: true,
      ticketNumber: ticket.ticketNumber,
      message: `Ticket ${ticket.ticketNumber} submitted successfully. Our team will review it shortly.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit ticket" }, { status: 500 });
  }
}
