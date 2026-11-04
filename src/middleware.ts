import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, decodeUserSession } from "@/lib/auth/users";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

const PUBLIC_PATHS = [
  "/raise-ticket",
  "/login",
  "/api/auth/login",
  "/api/tickets/public",
  "/api/tickets/upload-url",
  "/api/tickets/upload-local",
  "/api/tickets/photos",
  "/api/projects/public-directory",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public paths without authentication
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Allow MCP endpoint or webhook if API key / secret is provided
  if (pathname.startsWith("/api/work-logs") || pathname.startsWith("/api/github/webhook")) {
    return NextResponse.next();
  }

  // 3. Check for valid team member cookie
  const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = authCookie ? decodeUserSession(authCookie) : null;

  if (!user) {
    // If it's an API request, return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized: Please log in to access this resource" }, { status: 401 });
    }

    // Redirect browser requests to /login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
