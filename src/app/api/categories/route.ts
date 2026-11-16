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
    return NextResponse.json({ categories: [], availableMonths: [] });
  }

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  // Enforce account isolation: scope to requesting developer if not manager
  let accessibleLogs = [...snapshot.workLogs];
  const isDevUser = !isManager(auth);
  if (isDevUser && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanonId = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping).id;
    accessibleLogs = accessibleLogs.filter(
      (l) => resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === authCanonId
    );
  }

  // Derive unique available months for accessible logs
  const monthSet = new Set<string>();
  for (const l of accessibleLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  const hasFilter = (month && month !== "all") || !!startDate || !!endDate;

  // Filter logs by date range or month
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

  if (!hasFilter && !isDevUser) {
    return NextResponse.json({
      categories: snapshot.categories,
      availableMonths,
    });
  }

  const agg = computeAnalytics(
    filteredLogs,
    [],
    settings.projects,
    settings.developerGithubMapping
  );

  return NextResponse.json({
    categories: agg.categories,
    availableMonths,
    month,
    startDate,
    endDate,
  });
}
