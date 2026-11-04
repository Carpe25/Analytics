import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, decodeUserSession } from "@/lib/auth/users";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const user = decodeUserSession(token);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user });
}
