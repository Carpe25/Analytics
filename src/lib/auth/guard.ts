import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySignedSessionTokenAsync } from "@/lib/auth/users";
import { AuthUser } from "@/types";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

export interface RequestAuthContext {
  user: AuthUser | null;
  isApiKey: boolean;
  isCron: boolean;
  isAuthenticated: boolean;
}

/**
 * Universal authentication helper for API routes.
 * Strictly verifies cryptographic signatures or secure API keys:
 * 1. Cryptographically HMAC-SHA256 signed user session cookie
 * 2. TRACKER_API_KEY Bearer / x-api-key header (for MCP / CLI / Git Hooks)
 * 3. CRON_SECRET / MANUAL_SYNC_SECRET (for background jobs)
 */
export async function getRequestAuth(req: NextRequest): Promise<RequestAuthContext> {
  // 1. Check API Key for MCP / Git Hooks / Automation
  const apiKey = process.env.TRACKER_API_KEY?.trim();
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const customHeader = req.headers.get("x-api-key")?.trim();

  const isApiKey = Boolean(
    apiKey &&
    apiKey.length >= 16 &&
    ((bearerToken && bearerToken === apiKey) || (customHeader && customHeader === apiKey))
  );

  // 2. Check Cron Secret
  const cronSecret = process.env.CRON_SECRET?.trim();
  const cronProvided = bearerToken || req.headers.get("x-cron-secret")?.trim();
  const isCron = Boolean(cronSecret && cronSecret.length >= 8 && cronProvided && cronProvided === cronSecret);

  // 3. Check Cryptographically Signed Session Cookie (strict signature validation only)
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  let user: AuthUser | null = null;
  if (token) {
    user = await verifySignedSessionTokenAsync(token);
  }

  return {
    user,
    isApiKey,
    isCron,
    isAuthenticated: Boolean(user || isApiKey || isCron),
  };
}

/**
 * Enforces role-based permissions:
 * - Managers, valid API keys, or Cron tasks can perform management operations.
 * - Developers cannot perform manager-only actions (like mutating integrations or viewing other users' private settings).
 */
export function isManager(auth: RequestAuthContext): boolean {
  if (auth.isApiKey || auth.isCron) return true; // System/API key has full access
  return auth.user?.role === "manager";
}

/**
 * Enforces strict horizontal isolation between developer accounts.
 * - Managers and API keys can access any developer's records.
 * - Developers can ONLY access their own records (verified via canonical developer identity).
 */
export function canAccessDeveloper(
  auth: RequestAuthContext,
  targetDeveloperIdOrName: string,
  developerGithubMapping?: Record<string, string[]> | Record<string, string>
): boolean {
  if (!auth.isAuthenticated) return false;
  if (isManager(auth)) return true;

  if (auth.user?.role === "developer") {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, developerGithubMapping);
    const targetCanon = resolveCanonicalDeveloper(targetDeveloperIdOrName, developerGithubMapping);
    return authCanon.id === targetCanon.id;
  }

  return false;
}

/**
 * Helper to enforce developer access in route handlers.
 * Returns null if allowed, or a 403 Forbidden NextResponse if unauthorized.
 */
export function verifyDeveloperAccessOrForbidden(
  auth: RequestAuthContext,
  targetDeveloperIdOrName: string,
  developerGithubMapping?: Record<string, string[]> | Record<string, string>
): NextResponse | null {
  if (!canAccessDeveloper(auth, targetDeveloperIdOrName, developerGithubMapping)) {
    return NextResponse.json(
      {
        error: "Forbidden: You are not authorized to access another developer's account or records.",
      },
      { status: 403 }
    );
  }
  return null;
}
