import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();
  if (!snapshot) {
    return NextResponse.json({ categories: [], availableMonths: [] });
  }

  // Derive unique available months
  const monthSet = new Set<string>();
  for (const l of snapshot.workLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  if (!month || month === "all") {
    return NextResponse.json({
      categories: snapshot.categories,
      availableMonths,
    });
  }

  // Filter logs by month
  const filteredLogs = snapshot.workLogs.filter((l) => l.date.startsWith(month));
  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

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
  });
}
