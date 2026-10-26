import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  let startDate = searchParams.get("startDate");
  let endDate = searchParams.get("endDate");
  const projectId = searchParams.get("projectId");
  const developerId = searchParams.get("developerId");
  const category = searchParams.get("category");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();

  if (!snapshot) {
    return NextResponse.json({
      empty: true,
      message: "No synchronized analytics snapshot available yet. Configure Google Sheets and trigger a sync.",
    });
  }

  // Derive unique available months from the snapshot logs
  const monthSet = new Set<string>();
  for (const l of snapshot.workLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  // If no filters, return raw snapshot with availableMonths
  if (
    (!month || month === "all") &&
    !startDate &&
    !endDate &&
    (!projectId || projectId === "all") &&
    (!developerId || developerId === "all") &&
    (!category || category === "all")
  ) {
    return NextResponse.json({
      ...snapshot,
      availableMonths,
    });
  }

  // Apply filters
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
  if (projectId && projectId !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.projectId === projectId);
  }
  if (developerId && developerId !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.developerId === developerId);
  }
  if (category && category !== "all") {
    filteredLogs = filteredLogs.filter((l) => l.category === category);
  }

  let filteredCommits = [...snapshot.githubCommits];
  if (projectId && projectId !== "all") {
    filteredCommits = filteredCommits.filter((c) => c.projectId === projectId);
  }
  if (startDate) {
    filteredCommits = filteredCommits.filter((c) => c.commitDateUtc.slice(0, 10) >= startDate);
  }
  if (endDate) {
    filteredCommits = filteredCommits.filter((c) => c.commitDateUtc.slice(0, 10) <= endDate);
  }

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  const agg = computeAnalytics(
    filteredLogs,
    filteredCommits,
    settings.projects,
    settings.developerGithubMapping
  );

  return NextResponse.json({
    ...snapshot,
    availableMonths,
    summary: agg.summary,
    projects: agg.projects,
    developers: agg.developers,
    categories: agg.categories,
    workLogs: filteredLogs,
    githubCommits: filteredCommits,
    filtersApplied: {
      month,
      startDate,
      endDate,
      projectId,
      developerId,
      category,
    },
  });
}
