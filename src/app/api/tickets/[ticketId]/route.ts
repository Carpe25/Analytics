import { NextRequest, NextResponse } from "next/server";
import {
  makeTicketLive,
  assignTicket,
  unassignTicket,
  resolveTicket,
  readTickets,
} from "@/lib/tickets/ticket-service";
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = auth.user;
  const resolvedParams = await params;
  const { ticketId } = resolvedParams;

  try {
    const { action } = await req.json();

    if (action === "make_live") {
      if (!isManager(auth)) {
        return NextResponse.json({ error: "Only managers can review and make tickets live" }, { status: 403 });
      }

      const updated = await makeTicketLive(ticketId, user.name);
      if (!updated) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === "assign_to_me") {
      const tickets = await readTickets();
      const existing = tickets.find((t) => t.id === ticketId);
      if (!existing) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      if (existing.status !== "open" && !isManager(auth)) {
        return NextResponse.json(
          { error: "Cannot assign ticket: Ticket is not open or already assigned/resolved." },
          { status: 400 }
        );
      }

      const devId = user.developerId || `dev-${user.username.toLowerCase()}`;
      const devName = user.name;

      const updated = await assignTicket(ticketId, devId, devName);
      if (!updated) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === "unassign") {
      const tickets = await readTickets();
      const existing = tickets.find((t) => t.id === ticketId);
      if (!existing) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      if (!isManager(auth)) {
        const myDevId = user.developerId || `dev-${user.username.toLowerCase()}`;
        const myCanon = resolveCanonicalDeveloper(myDevId).id;
        const assignedTarget = existing.assignedToDeveloperId || existing.assignedToDeveloperName;
        const assignedCanon = assignedTarget ? resolveCanonicalDeveloper(assignedTarget).id : null;
        if (assignedCanon !== myCanon) {
          return NextResponse.json(
            { error: "Forbidden: You cannot unassign a ticket assigned to another developer." },
            { status: 403 }
          );
        }
      }

      const updated = await unassignTicket(ticketId);
      return NextResponse.json({ success: true, ticket: updated });
    }

    if (action === "resolve") {
      const tickets = await readTickets();
      const existing = tickets.find((t) => t.id === ticketId);
      if (!existing) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
      }

      if (!isManager(auth)) {
        const myDevId = user.developerId || `dev-${user.username.toLowerCase()}`;
        const myCanon = resolveCanonicalDeveloper(myDevId).id;
        const assignedTarget = existing.assignedToDeveloperId || existing.assignedToDeveloperName;
        const assignedCanon = assignedTarget ? resolveCanonicalDeveloper(assignedTarget).id : null;
        if (assignedCanon !== myCanon) {
          return NextResponse.json(
            { error: "Forbidden: You cannot resolve a ticket assigned to another developer." },
            { status: 403 }
          );
        }
      }

      const updated = await resolveTicket(ticketId);
      return NextResponse.json({ success: true, ticket: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Operation failed" }, { status: 500 });
  }
}
