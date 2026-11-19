import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as commitPost } from "@/app/api/work-logs/commit/route";
import { POST as sessionTouchPost } from "@/app/api/work-logs/session/touch/route";
import { GET as sessionActiveGet } from "@/app/api/work-logs/session/active/route";
import { getArtifactStorage } from "@/lib/storage/provider";
import { createSignedSessionToken } from "@/lib/auth/users";
import { verifySegregationOfDutiesOrForbidden } from "@/lib/auth/guard";
import { AuthUser, ActiveSession } from "@/types";

describe("Agentic Session Tracking & Anti-Manipulation Engine", () => {
  const originalEnv = { ...process.env };
  const storage = getArtifactStorage();

  beforeEach(async () => {
    process.env.SESSION_SECRET = "test-session-secret-key-64-bytes-super-secure!!";
    process.env.TRACKER_API_KEY = "test-tracker-api-key-32-chars-long";
    process.env.APP_TIMEZONE = "Asia/Kolkata";
    await storage.init();
    if (storage.clearActiveSession) {
      await storage.clearActiveSession("dev-jay");
      await storage.clearActiveSession("dev-manager");
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("touches and initializes an active session on agentic execution start", async () => {
    const req = new NextRequest("http://localhost:3000/api/work-logs/session/touch", {
      method: "POST",
      headers: {
        "x-api-key": process.env.TRACKER_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        developerName: "Jay",
        project: "Admin Portal",
        taskTicketId: "ENG-101",
        source: "agent_startup",
      }),
    });

    const res = await sessionTouchPost(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.isNewSession).toBe(true);
    expect(body.session.developerName).toBe("Jay");
    expect(body.session.project).toBe("Admin Portal");
    expect(body.session.taskTicketId).toBe("ENG-101");
  });

  it("calculates first task duration from active agentic session instead of arbitrary default", async () => {
    // 1. Manually seed an active session started 2 hours and 15 minutes ago (135 minutes)
    const nowMs = Date.now();
    const sessionStartMs = nowMs - 135 * 60 * 1000;
    const session: ActiveSession = {
      developerId: "dev-jay",
      developerName: "Jay",
      startedAtUtc: new Date(sessionStartMs).toISOString(),
      lastHeartbeatUtc: new Date(nowMs - 5 * 60 * 1000).toISOString(), // active 5 mins ago
      project: "Admin Portal",
    };

    if (storage.saveActiveSession) {
      await storage.saveActiveSession(session);
    }

    // 2. Commit arrives at nowMs
    const commitReq = new NextRequest("http://localhost:3000/api/work-logs/commit", {
      method: "POST",
      headers: {
        "x-api-key": process.env.TRACKER_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repoFullName: "Carpe25/admin-portal",
        commitSha: `test-sha-anchor-${Date.now()}`,
        message: "feat: implement anti-manipulation tracking",
        authorName: "Jay",
        commitTimestamp: Math.floor(nowMs / 1000),
      }),
    });

    const res = await commitPost(commitReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Verify it used the agentic session anchor (135 mins = 2.25 hours)
    expect(data.calculation.ruleApplied).toBe("agentic_session_anchor");
    expect(data.calculation.durationMinutes).toBe(135);
    expect(data.calculation.hours).toBe(2.25);
  });

  it("clamps unverified manual [time: 10h] overrides to prevent fraudulent inflation", async () => {
    const nowMs = Date.now();

    // Developer commits without an active session, but adds [time: 10h]
    const commitReq = new NextRequest("http://localhost:3000/api/work-logs/commit", {
      method: "POST",
      headers: {
        "x-api-key": process.env.TRACKER_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repoFullName: "Carpe25/admin-portal",
        commitSha: `test-sha-cheat-${Date.now()}`,
        message: "minor fix [time: 10h]",
        authorName: "Jay",
        commitTimestamp: Math.floor(nowMs / 1000),
      }),
    });

    const res = await commitPost(commitReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    // The system clamps unanchored excessive tag claims to 60m instead of granting 10 hours
    expect(data.calculation.durationMinutes).toBeLessThanOrEqual(60);
    expect(["unanchored_tag_clamped_max_60m", "claimed_tag_rapid_commit_capped_60m"]).toContain(data.calculation.ruleApplied);
  });

  it("pro-rates a cross-midnight shift commit into multiple daily work logs", async () => {
    // Start at 10:00 PM (22:00) on 2026-11-16 in Asia/Kolkata
    // Commit at 04:00 AM (04:00) on 2026-11-17 in Asia/Kolkata
    // Total: 6 hours (360 minutes) -> 2h on Day 1, 4h on Day 2
    const startMs = new Date("2026-11-16T22:00:00+05:30").getTime();
    const endMs = new Date("2026-11-17T04:00:00+05:30").getTime();

    const session: ActiveSession = {
      developerId: "dev-jay",
      developerName: "Jay",
      startedAtUtc: new Date(startMs).toISOString(),
      lastHeartbeatUtc: new Date(endMs - 15 * 60 * 1000).toISOString(),
      project: "Admin Portal",
    };

    if (storage.saveActiveSession) {
      await storage.saveActiveSession(session);
    }

    const commitReq = new NextRequest("http://localhost:3000/api/work-logs/commit", {
      method: "POST",
      headers: {
        "x-api-key": process.env.TRACKER_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repoFullName: "Carpe25/admin-portal",
        commitSha: `test-sha-midnight-${Date.now()}`,
        message: "feat: overnight cross-midnight development",
        authorName: "Jay",
        commitTimestamp: Math.floor(endMs / 1000),
      }),
    });

    const res = await commitPost(commitReq);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.calculation.durationMinutes).toBe(360);
    expect(data.calculation.daySlices).toHaveLength(2);

    // Verify Day 1 slice
    expect(data.calculation.daySlices[0].date).toBe("2026-11-16");
    expect(data.calculation.daySlices[0].durationMinutes).toBe(120);
    expect(data.calculation.daySlices[0].hours).toBe(2.0);

    // Verify Day 2 slice
    expect(data.calculation.daySlices[1].date).toBe("2026-11-17");
    expect(data.calculation.daySlices[1].durationMinutes).toBe(240);
    expect(data.calculation.daySlices[1].hours).toBe(4.0);

    // Verify work logs array returned
    expect(data.workLogs).toHaveLength(2);
    expect(data.workLogs[0].date).toBe("2026-11-16");
    expect(data.workLogs[1].date).toBe("2026-11-17");
  });

  describe("Segregation of Duties (SoD) Anti-Self-Approval", () => {
    it("BLOCKS a manager from approving or overriding their own work logs", () => {
      const managerAuth = {
        user: {
          username: "alice_manager",
          name: "Alice Manager",
          role: "manager" as const,
          developerId: "dev-alice-manager",
        },
        isApiKey: false,
        isCron: false,
        isAuthenticated: true,
      };

      // Alice attempts to self-approve a log belonging to dev-alice-manager
      const forbiddenResult = verifySegregationOfDutiesOrForbidden(
        managerAuth,
        "dev-alice-manager"
      );

      expect(forbiddenResult).not.toBeNull();
      expect(forbiddenResult?.status).toBe(403);
    });

    it("ALLOWS a manager to approve a peer developer's work log", () => {
      const managerAuth = {
        user: {
          username: "alice_manager",
          name: "Alice Manager",
          role: "manager" as const,
          developerId: "dev-alice-manager",
        },
        isApiKey: false,
        isCron: false,
        isAuthenticated: true,
      };

      // Alice approves Bob's log
      const allowedResult = verifySegregationOfDutiesOrForbidden(
        managerAuth,
        "dev-bob"
      );

      expect(allowedResult).toBeNull();
    });
  });
});
