import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySignedSessionTokenAsync } from "@/lib/auth/session";

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
  "/api/auth/me",
  "/api/health",
  "/api/tickets/public",
  "/api/tickets/upload-url",
  "/api/tickets/upload-local",
  "/api/tickets/upload",
  "/api/tickets/photos",
  "/api/projects/public-directory",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow public ticket submission, auth check, & photo assets without session check
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Automated background cron endpoint (strictly protected by internal CRON_SECRET inside handler)
  if (pathname === "/api/cron/sync") {
    return NextResponse.next();
  }

  // 3. Authenticate via Cryptographically Signed Session Token (HMAC-SHA256)
  const authCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = authCookie ? await verifySignedSessionTokenAsync(authCookie) : null;

  // 4. Also accept TRACKER_API_KEY in authorization header for programmatic / developer CLI access
  const apiKey = process.env.TRACKER_API_KEY?.trim();
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const customHeader = req.headers.get("x-api-key")?.trim();
  const hasValidApiKey = Boolean(
    apiKey &&
    apiKey.length >= 16 &&
    ((bearerToken && bearerToken === apiKey) || (customHeader && customHeader === apiKey))
  );

  // If unauthenticated, block immediately
  if (!user && !hasValidApiKey) {
    // API request: 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in or provide a valid API key to access this resource" },
        { status: 401 }
      );
    }

    // Browser navigation: Redirect to /login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Route-level RBAC: Protect sensitive management routes
  const managerOnlyPaths = ["/settings", "/api/settings", "/api/sync", "/sync-history"];
  const isManagerOnly = managerOnlyPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isManagerOnly && !hasValidApiKey && user?.role !== "manager") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden: This resource is restricted to Managers only." },
        { status: 403 }
      );
    }
    // Redirect unauthorized developer to dashboard overview
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}
