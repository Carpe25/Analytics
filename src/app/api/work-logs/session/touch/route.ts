import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getArtifactStorage } from "@/lib/storage/provider";
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { ActiveSession } from "@/types";

const SessionTouchInputSchema = z.object({
  developerName: z.string().optional(),
  developerId: z.string().optional(),
  project: z.string().optional(),
  client: z.string().optional(),
  category: z.string().optional(),
  taskTicketId: z.string().optional(),
  source: z.string().optional().default("mcp"),
  forceNewSession: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getRequestAuth(req);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized: Missing valid session token or API key" },
        { status: 401 }
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parseResult = SessionTouchInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const storage = getArtifactStorage();
    const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

    // Resolve developer identity
    let developerName: string;
    let developerId: string;

    if (!isManager(auth) && auth.user) {
      const authDevIdentifier = auth.user.developerId || auth.user.username;
      const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
      developerName = auth.user.name || authCanon.name;
      developerId = authCanon.id;
    } else {
      developerName = data.developerName?.trim() || process.env.DEVELOPER_NAME?.trim() || "Developer";
      const canon = resolveCanonicalDeveloper(developerName, settings.developerGithubMapping);
      developerId = data.developerId?.trim() || canon.id;
      developerName = canon.name;
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const MAX_IDLE_GAP_MS = 3 * 60 * 60 * 1000; // 3 hours

    let isNewSession = false;
    let session: ActiveSession | null = storage.getActiveSession ? await storage.getActiveSession(developerId) : null;

    if (!session || data.forceNewSession) {
      // No active session or forced reset
      session = {
        developerId,
        developerName,
        startedAtUtc: nowIso,
        lastHeartbeatUtc: nowIso,
        project: data.project?.trim() || undefined,
        client: data.client?.trim() || undefined,
        category: data.category?.trim() || undefined,
        taskTicketId: data.taskTicketId?.trim() || undefined,
        source: data.source,
      };
      isNewSession = true;
    } else {
      // Active session exists: check idle gap since last heartbeat
      const lastHeartbeatMs = new Date(session.lastHeartbeatUtc).getTime();
      const gapMs = nowMs - lastHeartbeatMs;

      if (gapMs > MAX_IDLE_GAP_MS) {
        // More than 3 hours since last activity: start a fresh session anchor!
        session = {
          developerId,
          developerName,
          startedAtUtc: nowIso,
          lastHeartbeatUtc: nowIso,
          project: data.project?.trim() || session.project,
          client: data.client?.trim() || session.client,
          category: data.category?.trim() || session.category,
          taskTicketId: data.taskTicketId?.trim() || session.taskTicketId,
          source: data.source || session.source,
        };
        isNewSession = true;
      } else {
        // Continuous session: update heartbeat and optional metadata
        session = {
          ...session,
          lastHeartbeatUtc: nowIso,
          project: data.project?.trim() || session.project,
          client: data.client?.trim() || session.client,
          category: data.category?.trim() || session.category,
          taskTicketId: data.taskTicketId?.trim() || session.taskTicketId,
        };
      }
    }

    if (storage.saveActiveSession) {
      await storage.saveActiveSession(session);
    }

    const startMs = new Date(session.startedAtUtc).getTime();
    const activeElapsedMinutes = Math.max(1, Math.round((nowMs - startMs) / 60000));
    const activeElapsedHours = Math.round((activeElapsedMinutes / 60) * 100) / 100;

    return NextResponse.json({
      success: true,
      message: isNewSession
        ? `Started new active session for ${developerName}`
        : `Heartbeat acknowledged for ${developerName}`,
      isNewSession,
      session,
      activeElapsedMinutes,
      activeElapsedHours,
    });
  } catch (err: any) {
    console.error("[/api/work-logs/session/touch] Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
