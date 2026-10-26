import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";

export async function GET(req: NextRequest) {
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

  if (!hasFilter) {
    return NextResponse.json({
      developers: snapshot.developers,
      availableMonths,
    });
  }

  // Filter logs by date range or month
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
    [],
    settings.projects,
    settings.developerGithubMapping
  );

  return NextResponse.json({
    developers: agg.developers,
    availableMonths,
    month,
    startDate,
    endDate,
  });
}
