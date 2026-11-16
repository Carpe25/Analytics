import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  let startDate = searchParams.get("startDate");
  let endDate = searchParams.get("endDate");
  const projectId = searchParams.get("projectId");
  const requestedDeveloperId = searchParams.get("developerId");
  const category = searchParams.get("category");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();

  if (!snapshot) {
    return NextResponse.json({
      empty: true,
      message: "No synchronized analytics snapshot available yet. Configure Google Sheets and trigger a sync.",
    });
  }

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  // Enforce developer account isolation
  const isDevUser = !isManager(auth);
  let authCanonId: string | null = null;

  if (isDevUser && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    authCanonId = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping).id;

    // If developer explicitly attempts to view another developer's metrics
    if (requestedDeveloperId && requestedDeveloperId !== "all") {
      const targetCanonId = resolveCanonicalDeveloper(requestedDeveloperId, settings.developerGithubMapping).id;
      if (targetCanonId !== authCanonId) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to view another developer's records." },
          { status: 403 }
        );
      }
    }
  }

  // Determine base logs and commits accessible to this caller
  let accessibleLogs = [...snapshot.workLogs];
  let accessibleCommits = [...(snapshot.githubCommits || [])];

  if (isDevUser && authCanonId) {
    // Developers can ONLY access their own records
    accessibleLogs = accessibleLogs.filter(
      (l) => resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === authCanonId
    );
    accessibleCommits = accessibleCommits.filter(
      (c) => resolveCanonicalDeveloper(c.authorLogin || c.authorName, settings.developerGithubMapping).id === authCanonId
    );
  }

  // Derive unique available months for the accessible logs
  const monthSet = new Set<string>();
  for (const l of accessibleLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  // Apply filters
  let filteredLogs = accessibleLogs;
  if (startDate) {
    filteredLogs = filteredLogs.filter((l) => l.date >= startDate);
  }
  if (endDate) {
    filteredLogs = filteredLogs.filter((l) => l.date <= endDate);
  }
  if (month && month !== "all" && !startDate && !endDate) {
    filteredLogs = filteredLogs.filter((l) => l.date.startsWith(month));
  }
  if (projectId && projectId !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.projectId === projectId);
  }
  if (!isDevUser && requestedDeveloperId && requestedDeveloperId !== "all") {
    const targetCanonId = resolveCanonicalDeveloper(requestedDeveloperId, settings.developerGithubMapping).id;
    filteredLogs = filteredLogs.filter(
      (l) => resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === targetCanonId
    );
  }
  if (category && category !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.category === category);
  }

  let filteredCommits = accessibleCommits;
  if (projectId && projectId !== "all") {
    filteredCommits = filteredCommits.filter((c) => c.projectId === projectId);
  }
  if (startDate) {
    filteredCommits = filteredCommits.filter((c) => c.commitDateUtc.slice(0, 10) >= startDate);
  }
  if (endDate) {
    filteredCommits = filteredCommits.filter((c) => c.commitDateUtc.slice(0, 10) <= endDate);
  }

  const agg = computeAnalytics(
    filteredLogs,
    filteredCommits,
    settings.projects,
    settings.developerGithubMapping
  );

  // If developer is logged in, ensure developers array contains ONLY themselves
  let finalDevelopers = agg.developers;
  if (isDevUser && authCanonId) {
    finalDevelopers = agg.developers.filter(
      (d) => resolveCanonicalDeveloper(d.id, settings.developerGithubMapping).id === authCanonId
    );
  }

  // Filter recent activity if developer
  let recentActivity = snapshot.recentActivity || [];
  if (isDevUser && authCanonId) {
    recentActivity = recentActivity.filter(
      (a) => resolveCanonicalDeveloper(a.developerId || a.developerName, settings.developerGithubMapping).id === authCanonId
    );
  }

  return NextResponse.json({
    schemaVersion: snapshot.schemaVersion,
    generatedAtUtc: snapshot.generatedAtUtc,
    displayTimezone: snapshot.displayTimezone,
    sourceStatus: snapshot.sourceStatus,
    lastSuccessfulSyncAtUtc: snapshot.lastSuccessfulSyncAtUtc,
    availableMonths,
    summary: {
      ...agg.summary,
      developerCount: finalDevelopers.length,
    },
    projects: agg.projects,
    developers: finalDevelopers,
    categories: agg.categories,
    workLogs: filteredLogs,
    githubCommits: filteredCommits,
    recentActivity,
    topProjects: snapshot.topProjects || [],
    filtersApplied: {
      month,
      startDate,
      endDate,
      projectId,
      developerId: isDevUser ? authCanonId : requestedDeveloperId,
      category,
    },
  });
}
