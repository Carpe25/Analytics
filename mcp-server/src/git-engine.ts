import { execSync } from "child_process";
import { TrackerApiClient } from "./api-client.js";

export interface GitCommitContext {
  isGitRepo: boolean;
  repoOwner?: string;
  repoName?: string;
  repoFullName?: string;
  branch?: string;
  commitSha?: string;
  shortSha?: string;
  authorName?: string;
  authorEmail?: string;
  commitTimestamp?: number;
  previousCommitTimestamp?: number;
  message?: string;
}

export function parseGitRemoteUrl(url: string): { owner: string; repo: string; fullName: string } | null {
  if (!url || typeof url !== "string") return null;
  const clean = url.trim().replace(/\.git$/i, "");

  // Match SSH: git@github.com:owner/repo
  const sshMatch = clean.match(/git@[^:]+:([^/]+)\/(.+)$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2], fullName: `${sshMatch[1]}/${sshMatch[2]}` };
  }

  // Match HTTPS / HTTP (with optional auth credentials): https://user:token@github.com/owner/repo
  const httpMatch = clean.match(/https?:\/\/(?:[^@]+@)?[^\/]+\/([^\/]+)\/(.+)$/);
  if (httpMatch) {
    return { owner: httpMatch[1], repo: httpMatch[2], fullName: `${httpMatch[1]}/${httpMatch[2]}` };
  }

  return null;
}

export function runGitCommand(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function getGitCommitContext(cwd?: string): GitCommitContext {
  const isInside = runGitCommand("rev-parse --is-inside-work-tree", cwd);
  if (isInside !== "true") {
    return { isGitRepo: false };
  }

  const remoteUrl = runGitCommand("remote get-url origin", cwd) || runGitCommand("config --get remote.origin.url", cwd);
  const parsedRemote = parseGitRemoteUrl(remoteUrl);

  const branch = runGitCommand("rev-parse --abbrev-ref HEAD", cwd) || undefined;
  let authorName = runGitCommand("config user.name", cwd);
  let authorEmail = runGitCommand("config user.email", cwd);

  // Latest commit details
  const rawLog = runGitCommand('log -1 --format="%H|%h|%an|%ae|%ct"', cwd);
  const fullMessage = runGitCommand('log -1 --format="%B"', cwd);

  if (!rawLog) {
    return {
      isGitRepo: true,
      branch,
      repoOwner: parsedRemote?.owner,
      repoName: parsedRemote?.repo,
      repoFullName: parsedRemote?.fullName,
      authorName: authorName || undefined,
      authorEmail: authorEmail || undefined,
    };
  }

  const [commitSha, shortSha, commitAuthorName, commitAuthorEmail, commitTimestampStr] = rawLog.split("|");
  authorName = authorName || commitAuthorName;
  authorEmail = authorEmail || commitAuthorEmail;

  const commitTimestamp = commitTimestampStr ? parseInt(commitTimestampStr, 10) : undefined;

  // Find previous commit by this author in local git history
  let previousCommitTimestamp: number | undefined;
  if (authorName) {
    const prevTimestampStr = runGitCommand(`log --author="${authorName}" --skip=1 -n 1 --format="%ct"`, cwd);
    if (prevTimestampStr) {
      previousCommitTimestamp = parseInt(prevTimestampStr, 10);
    }
  }

  return {
    isGitRepo: true,
    repoOwner: parsedRemote?.owner,
    repoName: parsedRemote?.repo,
    repoFullName: parsedRemote?.fullName,
    branch,
    commitSha,
    shortSha,
    authorName,
    authorEmail,
    commitTimestamp,
    previousCommitTimestamp,
    message: fullMessage || "Commit without message",
  };
}

export interface AutoLogOptions {
  cwd?: string;
  category?: string;
  project?: string;
  client?: string;
  taskTicketId?: string;
  dryRun?: boolean;
}

export async function autoLogCurrentGitCommit(client: TrackerApiClient, options: AutoLogOptions = {}) {
  const ctx = getGitCommitContext(options.cwd);

  if (!ctx.isGitRepo) {
    throw new Error("Current directory is not a Git repository.");
  }

  if (!ctx.commitSha || !ctx.message || !ctx.authorName) {
    throw new Error("No commits found in current repository.");
  }

  // Check for local project override in git config: git config tracker.project "..."
  const gitConfigProject = runGitCommand("config --get tracker.project", options.cwd);
  const gitConfigClient = runGitCommand("config --get tracker.client", options.cwd);

  const payload = {
    repoOwner: ctx.repoOwner,
    repoName: ctx.repoName,
    repoFullName: ctx.repoFullName,
    commitSha: ctx.commitSha,
    shortSha: ctx.shortSha,
    branch: ctx.branch,
    message: ctx.message,
    authorName: ctx.authorName,
    authorEmail: ctx.authorEmail,
    commitTimestamp: ctx.commitTimestamp,
    previousCommitTimestamp: ctx.previousCommitTimestamp,
    category: options.category,
    project: options.project || gitConfigProject || undefined,
    client: options.client || gitConfigClient || undefined,
    taskTicketId: options.taskTicketId,
  };

  if (options.dryRun) {
    return {
      dryRun: true,
      payload,
    };
  }

  return await client.logCommitWork(payload);
}
