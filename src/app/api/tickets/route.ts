import { NextRequest, NextResponse } from "next/server";
import { readTickets } from "@/lib/tickets/ticket-service";
import { AUTH_COOKIE_NAME, decodeUserSession } from "@/lib/auth/users";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? decodeUserSession(token) : null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
