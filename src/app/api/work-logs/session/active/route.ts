import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";

export async function GET(req: NextRequest) {
  try {
    const auth = await getRequestAuth(req);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storage = getArtifactStorage();
    const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

    const { searchParams } = new URL(req.url);
    const requestedDev = searchParams.get("developerId") || searchParams.get("developerName");

    let developerId: string;
    if (!isManager(auth) && auth.user) {
      const authDevIdentifier = auth.user.developerId || auth.user.username;
      const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
      developerId = authCanon.id;
    } else {
      const target = requestedDev || process.env.DEVELOPER_NAME || "Developer";
      developerId = resolveCanonicalDeveloper(target, settings.developerGithubMapping).id;
    }

    const session = storage.getActiveSession ? await storage.getActiveSession(developerId) : null;
    if (!session) {
      return NextResponse.json({ active: false, session: null });
    }

    const nowMs = Date.now();
    const startMs = new Date(session.startedAtUtc).getTime();
    const activeElapsedMinutes = Math.max(1, Math.round((nowMs - startMs) / 60000));
    const activeElapsedHours = Math.round((activeElapsedMinutes / 60) * 100) / 100;

    return NextResponse.json({
      active: true,
      session,
      activeElapsedMinutes,
      activeElapsedHours,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getRequestAuth(req);
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storage = getArtifactStorage();
    const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

    const { searchParams } = new URL(req.url);
    const requestedDev = searchParams.get("developerId") || searchParams.get("developerName");

    let developerId: string;
    if (!isManager(auth) && auth.user) {
      const authDevIdentifier = auth.user.developerId || auth.user.username;
      const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
      developerId = authCanon.id;
    } else {
      const target = requestedDev || process.env.DEVELOPER_NAME || "Developer";
      developerId = resolveCanonicalDeveloper(target, settings.developerGithubMapping).id;
    }

    if (storage.clearActiveSession) {
      await storage.clearActiveSession(developerId);
    }

    return NextResponse.json({ success: true, message: `Active session cleared for ${developerId}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
