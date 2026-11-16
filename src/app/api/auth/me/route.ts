import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySignedSessionTokenAsync } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  // Validate cryptographically signed session token
  const user = await verifySignedSessionTokenAsync(token);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user });
}
