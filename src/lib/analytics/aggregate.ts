import {
  WorkLog,
  GitHubCommit,
  ProjectSummary,
  DeveloperSummary,
  CategorySummary,
  AnalyticsSnapshot,
  ProjectConfig,
} from "@/types";
import { resolveProjectClient } from "@/lib/config/defaults";

export interface AggregationResult {
  summary: AnalyticsSnapshot["summary"];
  projects: ProjectSummary[];
  developers: DeveloperSummary[];
  categories: CategorySummary[];
  githubRepositories: AnalyticsSnapshot["githubRepositories"];
}

export function computeAnalytics(
  workLogs: WorkLog[],
  githubCommits: GitHubCommit[],
  configuredProjects: ProjectConfig[],
  developerGithubMapping: Record<string, string[]> = {}
): AggregationResult {
  let totalMinutes = 0;

  // Project map
  const projectMap = new Map<string, {
    id: string;
    name: string;
    code?: string;
    totalMinutes: number;
    developerIds: Set<string>;
    logCount: number;
    latestLogDate?: string;
  }>();

  // Initialize configured projects
  for (const p of configuredProjects) {
    projectMap.set(p.id, {
      id: p.id,
      name: p.name,
      code: p.code,
      totalMinutes: 0,
      developerIds: new Set<string>(),
      logCount: 0,
    });
  }

  // Developer map
  const developerMap = new Map<string, {
    id: string;
    name: string;
    sourceTabs: Set<string>;
    githubUsernames: Set<string>;
    totalMinutes: number;
    projects: Set<string>;
    categoryTotals: Record<string, number>;
    latestLogDate?: string;
  }>();

  // Category map
  const categoryMap = new Map<string, {
    name: string;
    totalMinutes: number;
    developers: Set<string>;
    projects: Set<string>;
  }>();

  // Aggregate Work Logs
  for (const log of workLogs) {
    totalMinutes += log.durationMinutes;

    // Project aggregate
    let proj = projectMap.get(log.projectId);
    if (!proj) {
      proj = {
        id: log.projectId,
        name: log.projectName,
        totalMinutes: 0,
        developerIds: new Set<string>(),
        logCount: 0,
      };
      projectMap.set(log.projectId, proj);
    }
    proj.totalMinutes += log.durationMinutes;
    proj.developerIds.add(log.developerId);
    proj.logCount += 1;
    if (!proj.latestLogDate || log.date > proj.latestLogDate) {
      proj.latestLogDate = log.date;
    }

    // Developer aggregate
    let dev = developerMap.get(log.developerId);
    if (!dev) {
      const mappedGh = developerGithubMapping[log.developerId] || [];
      dev = {
        id: log.developerId,
        name: log.developerName,
        sourceTabs: new Set<string>(),
        githubUsernames: new Set<string>(mappedGh),
        totalMinutes: 0,
        projects: new Set<string>(),
        categoryTotals: {},
      };
      developerMap.set(log.developerId, dev);
    }
    dev.totalMinutes += log.durationMinutes;
    dev.sourceTabs.add(log.sourceTab);
    dev.projects.add(log.projectName);
    dev.categoryTotals[log.category] = (dev.categoryTotals[log.category] || 0) + log.durationMinutes;
    if (!dev.latestLogDate || log.date > dev.latestLogDate) {
      dev.latestLogDate = log.date;
    }

    // Category aggregate
    let cat = categoryMap.get(log.category);
    if (!cat) {
      cat = {
        name: log.category,
        totalMinutes: 0,
        developers: new Set<string>(),
        projects: new Set<string>(),
      };
      categoryMap.set(log.category, cat);
    }
    cat.totalMinutes += log.durationMinutes;
    cat.developers.add(log.developerId);
    cat.projects.add(log.projectName);
  }

  // Aggregate GitHub commit stats
  const commitCountsByProject = new Map<string, number>();
  const latestCommitDateByProject = new Map<string, string>();
  const commitCountsByDeveloper = new Map<string, number>();
  const repoStats = new Map<string, {
    repoFullName: string;
    projectId: string;
    defaultBranch: string;
    lastSyncedAt?: string;
    commitCount: number;
  }>();

  for (const commit of githubCommits) {
    commitCountsByProject.set(
      commit.projectId,
      (commitCountsByProject.get(commit.projectId) || 0) + 1
    );

    const prevLatest = latestCommitDateByProject.get(commit.projectId);
    if (!prevLatest || commit.commitDateLocal > prevLatest) {
      latestCommitDateByProject.set(commit.projectId, commit.commitDateLocal);
    }

    // Match commit author to developer
    for (const [devId, dev] of Array.from(developerMap.entries())) {
      const logins = Array.from<string>(dev.githubUsernames).map((u: string) => u.toLowerCase());
      const authorLogin = (commit.authorLogin || "").toLowerCase();
      const authorName = (commit.authorName || "").toLowerCase();
      if (
        (authorLogin && logins.includes(authorLogin)) ||
        (authorName && authorName === dev.name.toLowerCase())
      ) {
        commitCountsByDeveloper.set(devId, (commitCountsByDeveloper.get(devId) || 0) + 1);
      }
    }

    // Repo stats
    let r = repoStats.get(commit.repoFullName);
    if (!r) {
      r = {
        repoFullName: commit.repoFullName,
        projectId: commit.projectId,
        defaultBranch: commit.branch || "main",
        lastSyncedAt: commit.fetchedAt,
        commitCount: 0,
      };
      repoStats.set(commit.repoFullName, r);
    }
    r.commitCount += 1;
  }

  // Format ProjectSummaries
  const projects: ProjectSummary[] = Array.from(projectMap.values()).map((p) => {
    const cfg = configuredProjects.find((cp) => cp.id === p.id);
    const connectedRepos = (cfg?.githubRepos || []).map((r) => `${r.owner}/${r.repo}`);
    const client = resolveProjectClient(p.name, cfg?.client);
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      client,
      totalMinutes: p.totalMinutes,
      totalHours: Number((p.totalMinutes / 60).toFixed(1)),
      developerCount: p.developerIds.size,
      logCount: p.logCount,
      connectedRepos,
      latestCommitDate: latestCommitDateByProject.get(p.id),
      latestLogDate: p.latestLogDate,
    };
  });

  // Format DeveloperSummaries
  const developers: DeveloperSummary[] = Array.from(developerMap.values()).map((d) => ({
    id: d.id,
    name: d.name,
    sourceTabs: Array.from(d.sourceTabs),
    githubUsernames: Array.from(d.githubUsernames),
    totalMinutes: d.totalMinutes,
    totalHours: Number((d.totalMinutes / 60).toFixed(1)),
    projectCount: d.projects.size,
    projects: Array.from(d.projects),
    categoryTotals: d.categoryTotals,
    latestLogDate: d.latestLogDate,
    commitCount: commitCountsByDeveloper.get(d.id) || 0,
  }));

  // Format CategorySummaries
  const categories: CategorySummary[] = Array.from(categoryMap.values()).map((c) => ({
    name: c.name,
    totalMinutes: c.totalMinutes,
    totalHours: Number((c.totalMinutes / 60).toFixed(1)),
    percentage: totalMinutes > 0 ? Number(((c.totalMinutes / totalMinutes) * 100).toFixed(1)) : 0,
    developerCount: c.developers.size,
    projects: Array.from(c.projects),
  }));

  return {
    summary: {
      totalHours: Number((totalMinutes / 60).toFixed(1)),
      totalMinutes,
      projectCount: projects.filter((p) => p.totalMinutes > 0).length,
      developerCount: developers.length,
      workLogCount: workLogs.length,
      githubCommitCount: githubCommits.length,
    },
    projects,
    developers,
    categories,
    githubRepositories: Array.from(repoStats.values()),
  };
}
