import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";

export async function GET(
  req: NextRequest,
  { params }: { params: { developerId: string } }
) {
  const { developerId } = params;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();

  if (!snapshot) {
    return NextResponse.json({ error: "No analytics snapshot available" }, { status: 404 });
  }

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;
  const canonicalTarget = resolveCanonicalDeveloper(developerId, settings.developerGithubMapping);

  // Derive unique available months for this developer across all matching aliases
  const allDevLogs = snapshot.workLogs.filter(
    (l) => resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === canonicalTarget.id
  );

  const monthSet = new Set<string>();
  for (const l of allDevLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  // Filter logs by date range or month if specified
  let developerLogs = [...allDevLogs];
  if (startDate) {
    developerLogs = developerLogs.filter((l) => l.date >= startDate);
  }
  if (endDate) {
    developerLogs = developerLogs.filter((l) => l.date <= endDate);
  }
  if (month && month !== "all" && !startDate && !endDate) {
    developerLogs = developerLogs.filter((l) => l.date.startsWith(month));
  }

  // Sort logs latest first (date descending, id descending)
  developerLogs.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const developer = snapshot.developers.find(
    (d) => resolveCanonicalDeveloper(d.id, settings.developerGithubMapping).id === canonicalTarget.id
  ) || {
    id: canonicalTarget.id,
    name: canonicalTarget.name,
    sourceTabs: [],
    githubUsernames: [],
    totalMinutes: 0,
    totalHours: 0,
    projectCount: 0,
    projects: [],
    categoryTotals: {},
    commitCount: 0,
  };

  const totalMinutes = developerLogs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));

  // 1. Project Breakdown for this developer (in selected month or all time)
  const projMap: Record<string, { id: string; name: string; minutes: number; count: number }> = {};
  for (const log of developerLogs) {
    if (!projMap[log.projectId]) {
      projMap[log.projectId] = {
        id: log.projectId,
        name: log.projectName,
        minutes: 0,
        count: 0,
      };
    }
    projMap[log.projectId].minutes += log.durationMinutes;
    projMap[log.projectId].count += 1;
  }

  const projectBreakdown = Object.values(projMap)
    .map((p) => ({
      ...p,
      hours: Number((p.minutes / 60).toFixed(1)),
      percentage: totalMinutes > 0 ? Number(((p.minutes / totalMinutes) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // 2. Category Breakdown for this developer
  const catMap: Record<string, { category: string; minutes: number; count: number }> = {};
  for (const log of developerLogs) {
    if (!catMap[log.category]) {
      catMap[log.category] = { category: log.category, minutes: 0, count: 0 };
    }
    catMap[log.category].minutes += log.durationMinutes;
    catMap[log.category].count += 1;
  }

  const categoryBreakdown = Object.values(catMap)
    .map((c) => ({
      ...c,
      hours: Number((c.minutes / 60).toFixed(1)),
      percentage: totalMinutes > 0 ? Number(((c.minutes / totalMinutes) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // 3. Project × Category Matrix for this developer
  const projectCategoryMatrix: Record<string, Record<string, number>> = {};
  for (const log of developerLogs) {
    if (!projectCategoryMatrix[log.projectName]) {
      projectCategoryMatrix[log.projectName] = {};
    }
    projectCategoryMatrix[log.projectName][log.category] =
      (projectCategoryMatrix[log.projectName][log.category] || 0) + log.durationMinutes;
  }

  return NextResponse.json({
    developer: {
      ...developer,
      totalMinutes,
      totalHours,
    },
    availableMonths,
    selectedMonth: month || "all",
    projectBreakdown,
    categoryBreakdown,
    projectCategoryMatrix,
    workLogs: developerLogs,
  });
}
