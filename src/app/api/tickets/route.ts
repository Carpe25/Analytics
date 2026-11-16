import { NextRequest, NextResponse } from "next/server";
import { readTickets } from "@/lib/tickets/ticket-service";
import { getRequestAuth } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user } = auth;
  const allTickets = await readTickets();

  // If Manager, return all tickets
  if (user.role === "manager") {
    return NextResponse.json({
      role: user.role,
      user,
      tickets: allTickets,
    });
  }

  // If Developer:
  // Developers see:
  // 1. "open" tickets
  // 2. All "assigned" tickets (so they know who is working on what, and their own tickets)
  // Developers MUST NOT see "under_review" tickets!
  const visibleTickets = allTickets.filter((t) => t.status !== "under_review");

  return NextResponse.json({
    role: user.role,
    user,
    tickets: visibleTickets,
  });
}
