import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS, resolveProjectClient } from "@/lib/config/defaults";
import { WorkLog, ProjectConfig, ProjectSummary } from "@/types";

function computeClientBreakdown(
  logs: WorkLog[],
  projectsConfig: ProjectConfig[],
  snapshotProjects: ProjectSummary[] = []
) {
  const clientGroups: Record<
    string,
    {
      clientName: string;
      totalMinutes: number;
      developerIds: Set<string>;
      logCount: number;
      projectsMap: Record<
        string,
        {
          id: string;
          name: string;
          code?: string;
          client: string;
          totalMinutes: number;
          developerIds: Set<string>;
          logCount: number;
          connectedRepos: string[];
          categoriesMap: Record<string, number>;
          latestLogDate?: string;
        }
      >;
    }
  > = {};

  for (const l of logs) {
    let client = (l.client || "").trim();
    if (client.toLowerCase() === "oromond") client = "Oramond";
    if (!client) client = "Unassigned";

    if (!clientGroups[client]) {
      clientGroups[client] = {
        clientName: client,
        totalMinutes: 0,
        developerIds: new Set(),
        logCount: 0,
        projectsMap: {},
      };
    }
    const grp = clientGroups[client];
    grp.totalMinutes += l.durationMinutes;
    grp.developerIds.add(l.developerId);
    grp.logCount += 1;

    if (!grp.projectsMap[l.projectId]) {
      const cfg = projectsConfig.find((p) => p.id === l.projectId);
      const snapProj = snapshotProjects.find((p) => p.id === l.projectId);
      const connectedRepos = (cfg?.githubRepos || []).map((r) => `${r.owner}/${r.repo}`);
      grp.projectsMap[l.projectId] = {
        id: l.projectId,
        name: l.projectName,
        code: cfg?.code || snapProj?.code,
        client,
        totalMinutes: 0,
        developerIds: new Set(),
        logCount: 0,
        connectedRepos: connectedRepos.length > 0 ? connectedRepos : (snapProj?.connectedRepos || []),
        categoriesMap: {},
        latestLogDate: l.date,
      };
    }

    const pEntry = grp.projectsMap[l.projectId];
    pEntry.totalMinutes += l.durationMinutes;
    pEntry.developerIds.add(l.developerId);
    pEntry.logCount += 1;
    if (l.category) {
      pEntry.categoriesMap[l.category] = (pEntry.categoriesMap[l.category] || 0) + l.durationMinutes;
    }
    if (!pEntry.latestLogDate || l.date > pEntry.latestLogDate) {
      pEntry.latestLogDate = l.date;
    }
  }

  return Object.values(clientGroups)
    .map((c) => {
      const projects = Object.values(c.projectsMap)
        .map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          client: p.client,
          totalMinutes: p.totalMinutes,
          totalHours: Number((p.totalMinutes / 60).toFixed(1)),
          developerCount: p.developerIds.size,
          logCount: p.logCount,
          connectedRepos: p.connectedRepos,
          categories: Object.keys(p.categoriesMap).sort((a, b) => p.categoriesMap[b] - p.categoriesMap[a]),
          latestLogDate: p.latestLogDate,
        }))
        .sort((a, b) => b.totalHours - a.totalHours);

      return {
        clientName: c.clientName,
        totalMinutes: c.totalMinutes,
        totalHours: Number((c.totalMinutes / 60).toFixed(1)),
        developerCount: c.developerIds.size,
        logCount: c.logCount,
        projects,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();
  if (!snapshot) {
    return NextResponse.json({
      projects: [],
      clientBreakdown: [],
      availableMonths: [],
      availableCategories: [],
    });
  }

  // Derive unique available months
  const monthSet = new Set<string>();
  for (const l of snapshot.workLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  let logsToProcess = [...snapshot.workLogs];
  if (startDate) {
    logsToProcess = logsToProcess.filter((l) => l.date >= startDate);
  }
  if (endDate) {
    logsToProcess = logsToProcess.filter((l) => l.date <= endDate);
  }
  if (month && month !== "all" && !startDate && !endDate) {
    logsToProcess = logsToProcess.filter((l) => l.date.startsWith(month));
  }

  // Extract unique categories directly from work logs
  const categorySet = new Set<string>();
  logsToProcess.forEach((l) => {
    if (l.category && l.category.trim()) {
      categorySet.add(l.category.trim());
    }
  });
  const availableCategories = Array.from(categorySet).sort();

  const clientBreakdown = computeClientBreakdown(
    logsToProcess,
    settings.projects,
    snapshot.projects
  );

  const hasFilter = (month && month !== "all") || !!startDate || !!endDate;

  if (!hasFilter) {
    const projectsWithClient = snapshot.projects.map((p) => {
      const cfg = settings.projects.find((cp) => cp.id === p.id);
      return {
        ...p,
        client: p.client || resolveProjectClient(p.name, cfg?.client),
      };
    });
    return NextResponse.json({
      projects: projectsWithClient,
      clientBreakdown,
      availableMonths,
      availableCategories,
    });
  }

  const agg = computeAnalytics(
    logsToProcess,
    snapshot.githubCommits,
    settings.projects,
    settings.developerGithubMapping
  );

  return NextResponse.json({
    projects: agg.projects,
    clientBreakdown,
    availableMonths,
    availableCategories,
    month,
  });
}
