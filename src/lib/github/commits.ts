import { getGitHubClient } from "./client";
import { GitHubCommit, ProjectConfig } from "@/types";
import { formatDateTimeInTimezone } from "@/lib/utils";
import { getAppEnv } from "@/lib/config/env";

export interface FetchCommitsResult {
  commits: GitHubCommit[];
  errors: string[];
  warnings: string[];
}

export async function fetchAllProjectCommits(
  projects: ProjectConfig[],
  sinceDate?: string
): Promise<FetchCommitsResult> {
  const client = getGitHubClient();
  const errors: string[] = [];
  const warnings: string[] = [];
  const env = getAppEnv();

  if (!client) {
    warnings.push("GitHub integration is not configured (missing GITHUB_TOKEN). Skipping commit fetch.");
    return { commits: [], errors, warnings };
  }

  // Calculate default 'since' date if provided or requested
  const since = sinceDate || undefined;
  const fetchedAt = new Date().toISOString();
  const commitMap = new Map<string, GitHubCommit>();

  for (const project of projects) {
    if (!project.githubRepos || project.githubRepos.length === 0) {
      continue;
    }

    for (const repoConfig of project.githubRepos) {
      const { owner, repo, defaultBranch } = repoConfig;
      const repoFullName = `${owner}/${repo}`;

      // Step A: Discover all branches in the repository
      let branchNames: string[] = [];
      try {
        const branchesRes = await client.repos.listBranches({
          owner,
          repo,
          per_page: 100,
        });
        branchNames = branchesRes.data.map((b) => b.name);
      } catch (err: any) {
        // Fallback to default branch if branch listing encounters permission/rate limit
        branchNames = [defaultBranch || "main"];
      }

      if (branchNames.length === 0) {
        branchNames = [defaultBranch || "main"];
      }

      // Step B: Query commits across all discovered branches
      for (const branch of branchNames) {
        try {
          const response = await client.repos.listCommits({
            owner,
            repo,
            sha: branch,
            since,
            per_page: 100,
          });

          for (const item of response.data) {
            const sha = item.sha;
            const key = `${repoFullName}:${sha}`;

            if (commitMap.has(key)) {
              const existing = commitMap.get(key)!;
              if (existing.branches && !existing.branches.includes(branch)) {
                existing.branches.push(branch);
              }
              continue;
            }

            const shortSha = sha.slice(0, 7);
            const commitDateUtc = item.commit.author?.date || item.commit.committer?.date || fetchedAt;
            const commitDateLocal = formatDateTimeInTimezone(commitDateUtc, env.appTimezone);

            commitMap.set(key, {
              sha,
              shortSha,
              repoOwner: owner,
              repoName: repo,
              repoFullName,
              projectId: project.id,
              projectName: project.name,
              message: item.commit.message,
              authorName: item.commit.author?.name || item.author?.login || "Unknown",
              authorEmail: item.commit.author?.email || undefined,
              authorLogin: item.author?.login || undefined,
              authorAvatarUrl: item.author?.avatar_url || undefined,
              committerName: item.commit.committer?.name || undefined,
              commitDateUtc,
              commitDateLocal,
              commitUrl: item.html_url,
              branch,
              branches: [branch],
              fetchedAt,
            });
          }
        } catch (err: any) {
          // If a specific branch fails, record warning and continue with others
          const msg = err.message || "Failed to fetch commits";
          warnings.push(`Repo ${repoFullName} branch "${branch}" commit fetch warning: ${msg}`);
        }
      }
    }
  }

  // Sort all unique commits descending by date
  const sortedCommits = Array.from(commitMap.values()).sort(
    (a, b) => new Date(b.commitDateUtc).getTime() - new Date(a.commitDateUtc).getTime()
  );

  return {
    commits: sortedCommits,
    errors,
    warnings,
  };
}
