import { IArtifactStorage } from "@/lib/storage/interface";
import { ProjectConfig, GitHubRepoConfig, AnalyticsSnapshot, WorkLog, GitHubCommit } from "@/types";
import { DEFAULT_INTEGRATION_SETTINGS, resolveProjectClient } from "@/lib/config/defaults";
import { fetchAllProjectCommits } from "@/lib/github/commits";
import { computeAnalytics } from "@/lib/analytics/aggregate";

export interface UnifiedProject {
  id: string;
  name: string;
  code?: string;
  client: string;
  aliases: string[];
  githubRepos: GitHubRepoConfig[];
  isConfigured: boolean;
  totalMinutes?: number;
  developerCount?: number;
}

export class ProjectService {
  constructor(private storage: IArtifactStorage) {}

  /**
   * Retrieves all projects, seamlessly combining configured projects from settings
   * with any dynamically discovered projects from Google Sheets work logs.
   */
  async getAllProjects(): Promise<UnifiedProject[]> {
    let settings = await this.storage.readIntegrationSettings();
    if (!settings) {
      settings = DEFAULT_INTEGRATION_SETTINGS;
      await this.storage.writeIntegrationSettings(settings);
    }

    const snapshot = await this.storage.readLatestAnalytics();
    const configuredMap = new Map<string, ProjectConfig>();

    for (const p of settings.projects) {
      configuredMap.set(p.id, p);
    }

    const result: UnifiedProject[] = [];

    // Add all configured projects
    for (const p of settings.projects) {
      const snap = snapshot?.projects.find((sp) => sp.id === p.id);
      result.push({
        id: p.id,
        name: p.name,
        code: p.code,
        client: p.client || resolveProjectClient(p.name),
        aliases: p.aliases || [p.name],
        githubRepos: p.githubRepos || [],
        isConfigured: true,
        totalMinutes: snap?.totalMinutes,
        developerCount: snap?.developerCount,
      });
    }

    // Discover any additional projects from snapshot and work logs
    if (snapshot?.projects) {
      for (const sp of snapshot.projects) {
        if (!configuredMap.has(sp.id)) {
          const sampleLog = snapshot.workLogs?.find((l) => l.projectId === sp.id);
          const client = sampleLog?.client || sp.client || resolveProjectClient(sp.name);

          result.push({
            id: sp.id,
            name: sp.name,
            code: sp.code,
            client,
            aliases: [sp.name],
            githubRepos: [],
            isConfigured: false,
            totalMinutes: sp.totalMinutes,
            developerCount: sp.developerCount,
          });
        }
      }
    }

    // Sort by client then name
    return result.sort((a, b) => {
      const clientCmp = (a.client || "").localeCompare(b.client || "");
      if (clientCmp !== 0) return clientCmp;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Connects a GitHub repository to a project.
   * If the project is not yet in settings.projects, it is automatically added.
   * Also triggers immediate commit fetching for this repository.
   */
  async connectRepository(
    projectId: string,
    repoInput: { owner: string; repo: string; defaultBranch?: string }
  ): Promise<{ success: boolean; project: ProjectConfig; commitsFetched: number }> {
    const owner = repoInput.owner.trim();
    const repo = repoInput.repo.trim();
    const defaultBranch = repoInput.defaultBranch?.trim() || "main";

    if (!owner || !repo) {
      throw new Error("Owner and repository name are required.");
    }

    let settings = await this.storage.readIntegrationSettings();
    if (!settings) {
      settings = DEFAULT_INTEGRATION_SETTINGS;
    }

    const snapshot = await this.storage.readLatestAnalytics();

    // Check if project is already in settings.projects
    let targetProject = settings.projects.find((p) => p.id === projectId);

    if (!targetProject) {
      // Find metadata from snapshot or work logs
      const snapProj = snapshot?.projects.find((p) => p.id === projectId);
      const sampleLog = snapshot?.workLogs?.find((l) => l.projectId === projectId);
      const projectName = snapProj?.name || sampleLog?.projectName || projectId;
      const client = sampleLog?.client || snapProj?.client || resolveProjectClient(projectName);
      const code = snapProj?.code;

      targetProject = {
        id: projectId,
        name: projectName,
        code,
        client,
        aliases: [projectName],
        githubRepos: [],
      };
      settings.projects.push(targetProject);
    }

    // Check if repo already connected
    const existing = (targetProject.githubRepos || []).some(
      (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase()
    );

    if (!existing) {
      targetProject.githubRepos = [
        ...(targetProject.githubRepos || []),
        { owner, repo, defaultBranch },
      ];
    }

    // Save updated settings
    await this.storage.writeIntegrationSettings(settings);

    // Fetch commits for this repository if possible
    let commitsFetched = 0;
    try {
      const commitRes = await fetchAllProjectCommits([targetProject]);
      commitsFetched = commitRes.commits.length;

      if (snapshot && commitRes.commits.length > 0) {
        // Merge commits into snapshot
        const existingCommits = snapshot.githubCommits || [];
        const commitMap = new Map<string, GitHubCommit>();
        for (const c of existingCommits) {
          commitMap.set(`${c.repoFullName}:${c.sha}`, c);
        }
        for (const c of commitRes.commits) {
          commitMap.set(`${c.repoFullName}:${c.sha}`, c);
        }

        const mergedCommits = Array.from(commitMap.values()).sort(
          (a, b) => new Date(b.commitDateUtc).getTime() - new Date(a.commitDateUtc).getTime()
        );

        // Recompute analytics
        const aggResult = computeAnalytics(
          snapshot.workLogs || [],
          mergedCommits,
          settings.projects,
          settings.developerGithubMapping
        );

        const updatedSnapshot: AnalyticsSnapshot = {
          ...snapshot,
          summary: aggResult.summary,
          projects: aggResult.projects,
          developers: aggResult.developers,
          categories: aggResult.categories,
          githubCommits: mergedCommits,
          githubRepositories: aggResult.githubRepositories,
        };

        await this.storage.publishLatestAnalytics(updatedSnapshot);
      }
    } catch (err) {
      console.warn("Could not immediately fetch commits for new repository:", err);
    }

    return {
      success: true,
      project: targetProject,
      commitsFetched,
    };
  }

  /**
   * Disconnects a GitHub repository from a project.
   */
  async disconnectRepository(
    projectId: string,
    owner: string,
    repo: string
  ): Promise<{ success: boolean }> {
    let settings = await this.storage.readIntegrationSettings();
    if (!settings) return { success: true };

    const targetProject = settings.projects.find((p) => p.id === projectId);
    if (!targetProject || !targetProject.githubRepos) {
      return { success: true };
    }

    targetProject.githubRepos = targetProject.githubRepos.filter(
      (r) => !(r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase())
    );

    await this.storage.writeIntegrationSettings(settings);

    // Remove commits for this repository from snapshot if exists
    const snapshot = await this.storage.readLatestAnalytics();
    if (snapshot && snapshot.githubCommits) {
      const filteredCommits = snapshot.githubCommits.filter(
        (c) => !(c.repoOwner.toLowerCase() === owner.toLowerCase() && c.repoName.toLowerCase() === repo.toLowerCase())
      );

      const aggResult = computeAnalytics(
        snapshot.workLogs || [],
        filteredCommits,
        settings.projects,
        settings.developerGithubMapping
      );

      const updatedSnapshot: AnalyticsSnapshot = {
        ...snapshot,
        summary: aggResult.summary,
        projects: aggResult.projects,
        developers: aggResult.developers,
        categories: aggResult.categories,
        githubCommits: filteredCommits,
        githubRepositories: aggResult.githubRepositories,
      };

      await this.storage.publishLatestAnalytics(updatedSnapshot);
    }

    return { success: true };
  }
}
