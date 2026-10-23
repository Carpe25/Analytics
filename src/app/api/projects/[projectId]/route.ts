import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;
  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();
  const settings = await storage.readIntegrationSettings();

  if (!snapshot) {
    return NextResponse.json({ error: "No analytics snapshot available" }, { status: 404 });
  }

  const project = snapshot.projects.find((p) => p.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectLogs = snapshot.workLogs.filter((l) => l.projectId === projectId);
  const projectCommits = snapshot.githubCommits.filter((c) => c.projectId === projectId);

  // Developer breakdown
  const devMinutes: Record<string, { id: string; name: string; minutes: number; count: number }> = {};
  for (const log of projectLogs) {
    if (!devMinutes[log.developerId]) {
      devMinutes[log.developerId] = {
        id: log.developerId,
        name: log.developerName,
        minutes: 0,
        count: 0,
      };
    }
    devMinutes[log.developerId].minutes += log.durationMinutes;
    devMinutes[log.developerId].count += 1;
  }

  // Category breakdown
  const catMinutes: Record<string, { category: string; minutes: number; count: number }> = {};
  for (const log of projectLogs) {
    if (!catMinutes[log.category]) {
      catMinutes[log.category] = { category: log.category, minutes: 0, count: 0 };
    }
    catMinutes[log.category].minutes += log.durationMinutes;
    catMinutes[log.category].count += 1;
  }

  // Developer x Category matrix
  const devCategoryMatrix: Record<string, Record<string, number>> = {};
  for (const log of projectLogs) {
    if (!devCategoryMatrix[log.developerName]) {
      devCategoryMatrix[log.developerName] = {};
    }
    devCategoryMatrix[log.developerName][log.category] =
      (devCategoryMatrix[log.developerName][log.category] || 0) + log.durationMinutes;
  }

  // Config mapping info
  const config = settings?.projects.find((p) => p.id === projectId);

  return NextResponse.json({
    project,
    config,
    workLogs: projectLogs,
    commits: projectCommits,
    developerBreakdown: Object.values(devMinutes).map((d) => ({
      ...d,
      hours: Number((d.minutes / 60).toFixed(1)),
      percentage: project.totalMinutes > 0 ? Number(((d.minutes / project.totalMinutes) * 100).toFixed(1)) : 0,
    })),
    categoryBreakdown: Object.values(catMinutes).map((c) => ({
      ...c,
      hours: Number((c.minutes / 60).toFixed(1)),
      percentage: project.totalMinutes > 0 ? Number(((c.minutes / project.totalMinutes) * 100).toFixed(1)) : 0,
    })),
    devCategoryMatrix,
  });
}
