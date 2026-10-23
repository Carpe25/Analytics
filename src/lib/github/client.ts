import { Octokit } from "@octokit/rest";
import { getAppEnv } from "@/lib/config/env";

export function getGitHubClient(): Octokit | null {
  const env = getAppEnv();

  if (env.githubAuthMode === "token") {
    if (!env.githubToken) return null;
    return new Octokit({ auth: env.githubToken });
  }

  // GitHub token can also be fallback
  if (env.githubToken) {
    return new Octokit({ auth: env.githubToken });
  }

  return null;
}

export async function testGitHubAccess(owner: string, repo: string): Promise<{
  success: boolean;
  message: string;
  defaultBranch?: string;
  isPrivate?: boolean;
}> {
  const client = getGitHubClient();
  if (!client) {
    return {
      success: false,
      message: "GitHub Personal Access Token is not configured (missing GITHUB_TOKEN in environment).",
    };
  }

  try {
    const res = await client.repos.get({ owner, repo });
    return {
      success: true,
      message: `Successfully connected to repository ${res.data.full_name} (${res.data.private ? "Private" : "Public"}).`,
      defaultBranch: res.data.default_branch,
      isPrivate: res.data.private,
    };
  } catch (err: any) {
    const status = err.status;
    const msg = err.message || "Failed to access repository";
    if (status === 404) {
      return {
        success: false,
        message: `Repository "${owner}/${repo}" was not found (or token lacks permission to view private repos).`,
      };
    }
    if (status === 401 || status === 403) {
      return {
        success: false,
        message: `GitHub authentication failed (${status}): ${msg}. Check GITHUB_TOKEN permissions.`,
      };
    }
    return {
      success: false,
      message: `GitHub API error: ${msg}`,
    };
  }
}
