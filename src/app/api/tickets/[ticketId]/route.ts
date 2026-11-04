import { NextRequest, NextResponse } from "next/server";
import {
  makeTicketLive,
  assignTicket,
  unassignTicket,
  resolveTicket,
} from "@/lib/tickets/ticket-service";
import { AUTH_COOKIE_NAME, decodeUserSession } from "@/lib/auth/users";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? decodeUserSession(token) : null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const { ticketId } = resolvedParams;

  try {
    const { action } = await req.json();

    if (action === "make_live") {
      if (user.role !== "manager") {
        return NextResponse.json({ error: "Only managers can review and make tickets live" }, { status: 403 });
      }

      const updated = await makeTicketLive(ticketId, user.name);
      if (!updated) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === "assign_to_me") {
      const devId = user.developerId || `dev-${user.username.toLowerCase()}`;
      const devName = user.name;

      const updated = await assignTicket(ticketId, devId, devName);
      if (!updated) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === "unassign") {
      const updated = await unassignTicket(ticketId);
      if (!updated) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === "resolve") {
      const updated = await resolveTicket(ticketId);
      if (!updated) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}
