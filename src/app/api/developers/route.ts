import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();
  if (!snapshot) {
    return NextResponse.json({ developers: [], availableMonths: [] });
  }

  // Derive unique available months
  const monthSet = new Set<string>();
  for (const l of snapshot.workLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  const hasFilter = (month && month !== "all") || !!startDate || !!endDate;

  // Filter logs by date range or month if specified
  let filteredLogs = [...snapshot.workLogs];
  if (startDate) {
    filteredLogs = filteredLogs.filter((l) => l.date >= startDate);
  }
  if (endDate) {
    filteredLogs = filteredLogs.filter((l) => l.date <= endDate);
  }
  if (month && month !== "all" && !startDate && !endDate) {
    filteredLogs = filteredLogs.filter((l) => l.date.startsWith(month));
  }

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  const agg = computeAnalytics(
    filteredLogs,
    snapshot.githubCommits || [],
    settings.projects,
    settings.developerGithubMapping
  );

  // If viewing all records and database snapshot has unmerged duplicates, heal snapshot asynchronously
  if (!hasFilter && snapshot.developers.length !== agg.developers.length) {
    storage.publishLatestAnalytics({
      ...snapshot,
      developers: agg.developers,
      summary: {
        ...snapshot.summary,
        developerCount: agg.developers.length,
      },
    }).catch((err) => console.warn("Could not heal unmerged developers in snapshot:", err));
  }

  let developers = agg.developers;
  if (!isManager(auth)) {
    const authDevIdentifier = auth.user?.developerId || auth.user?.username || "";
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
    developers = agg.developers.filter(
      (d) => resolveCanonicalDeveloper(d.id, settings.developerGithubMapping).id === authCanon.id
    );
  }

  return NextResponse.json({
    developers,
    availableMonths,
    month,
    startDate,
    endDate,
  });
}
