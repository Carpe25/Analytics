import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { resolveProjectClient, canonicalClient, isSameClient } from "@/lib/config/defaults";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

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

  const config = settings?.projects.find((p) => p.id === projectId || (p.aliases && p.aliases.includes(projectId)));
  let project = snapshot.projects.find((p) => p.id === projectId || p.id === config?.id);

  if (!project && config) {
    project = {
      id: config.id,
      name: config.name,
      code: config.code,
      client: config.client,
      totalMinutes: 0,
      totalHours: 0,
      developerCount: 0,
      logCount: 0,
      connectedRepos: (config.githubRepos || []).map((r) => `${r.owner}/${r.repo}`),
    };
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const targetClient = project.client || config?.client;

  const connectedRepoSet = new Set(
    (config?.githubRepos || []).map((r) => `${r.owner}/${r.repo}`.toLowerCase())
  );
  if (project.connectedRepos) {
    for (const r of project.connectedRepos) {
      connectedRepoSet.add(r.toLowerCase());
    }
  }

  // Filter commits strictly to this project's ID or connected repositories
  const projectCommits = (snapshot.githubCommits || []).filter((c) => {
    if (connectedRepoSet.size > 0 && connectedRepoSet.has(c.repoFullName.toLowerCase())) {
      return true;
    }
    return c.projectId === projectId || (config && c.projectId === config.id);
  });

  const projectCommitShas = new Set(
    projectCommits.map((c) => c.shortSha?.toLowerCase() || c.sha.slice(0, 7).toLowerCase())
  );
  const projectCommitFullShas = new Set(projectCommits.map((c) => c.sha.toLowerCase()));

  // Canonicalize and sort logs latest-first (date descending)
  // Ensure GIT work logs are strictly verified against this project's commits
  const projectLogs = snapshot.workLogs
    .filter((log) => {
      // 1. Client must match if project has a client
      if (targetClient && log.client && !isSameClient(log.client, targetClient)) {
        return false;
      }

      // 2. If it is a GIT work log, it MUST originate from this project's commits!
      if (log.sourceTab === "GIT") {
        const parts = log.id.split("-");
        const logSha = parts[parts.length - 1]?.toLowerCase();
        if (logSha) {
          if (!projectCommitShas.has(logSha) && !projectCommitFullShas.has(logSha)) {
            return false;
          }
        }
      }

      // 3. Project ID or name must match
      const projIdMatches = log.projectId === projectId || (config && log.projectId === config.id);
      const projNameMatches =
        log.projectName && project.name && log.projectName.toLowerCase() === project.name.toLowerCase();

      return projIdMatches || (projNameMatches && targetClient && isSameClient(log.client, targetClient));
    })
    .map((log) => {
      const canon = resolveCanonicalDeveloper(log.developerId || log.developerName, settings?.developerGithubMapping);
      return {
        ...log,
        developerId: canon.id,
        developerName: canon.name,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  // Developer breakdown with canonical identities
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

  // Return project details with canonical data

  return NextResponse.json({
    project: {
      ...project,
      client: project.client || config?.client || resolveProjectClient(project.name, config?.client),
      connectedRepos: (config?.githubRepos && config.githubRepos.length > 0)
        ? config.githubRepos.map((r) => `${r.owner}/${r.repo}`)
        : (project.connectedRepos || []),
    },
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
