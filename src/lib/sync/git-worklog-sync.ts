import { GitHubCommit, ProjectConfig, WorkLog } from "@/types";
import { inferCategoryFromCommitMessage, resolveProjectByGitHubRepo } from "@/lib/mcp/resolution";

function formatDateInTimezone(d: Date, tz: string = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export interface SyncCommitLogsOptions {
  timezone?: string;
  defaultSessionMinutes?: number;
  minDurationMinutes?: number;
  maxGapMinutes?: number;
}

export interface SyncCommitLogsResult {
  newLogs: WorkLog[];
  allWorkLogs: WorkLog[];
  createdCount: number;
}

/**
 * Checks existing work logs for each developer, finds their latest log date,
 * and automatically converts unlogged commits from that date to the current date into work logs.
 */
export function generateWorkLogsFromGitHubCommits(
  commits: GitHubCommit[],
  existingWorkLogs: WorkLog[],
  configuredProjects: ProjectConfig[] = [],
  developerGithubMapping: Record<string, string[]> = {},
  options: SyncCommitLogsOptions = {}
): SyncCommitLogsResult {
  const timezone = options.timezone || "Asia/Kolkata";
  const defaultSessionMinutes = options.defaultSessionMinutes || 45;
  const minDurationMinutes = options.minDurationMinutes || 10;
  const maxGapMinutes = options.maxGapMinutes || 240; // 4 hours

  // 1. Index existing work logs to prevent any duplicate entries for the same commit
  const loggedCommitShas = new Set<string>();
  const loggedSignatures = new Set<string>();

  for (const log of existingWorkLogs) {
    if (log.id.startsWith("log-git-")) {
      const parts = log.id.split("-");
      const sha = parts[parts.length - 1];
      if (sha) loggedCommitShas.add(sha.toLowerCase());
    }
    // Also add signature: date_dev_description
    const sig = `${log.date}_${log.developerName.toLowerCase()}_${log.description.toLowerCase().trim()}`;
    loggedSignatures.add(sig);
  }

  // 2. Map GitHub username/authorName to developer identity
  // Build reverse lookup: githubLogin/name -> developerId
  const githubUserToDevId = new Map<string, string>();
  for (const [devId, handles] of Object.entries(developerGithubMapping)) {
    for (const h of handles) {
      githubUserToDevId.set(h.toLowerCase(), devId);
    }
  }

  // 3. Group commits by developer
  const commitsByDev = new Map<string, { devId: string; devName: string; commits: GitHubCommit[] }>();

  for (const commit of commits) {
    let devId: string | undefined;
    let devName = commit.authorName || "Developer";

    if (commit.authorLogin && githubUserToDevId.has(commit.authorLogin.toLowerCase())) {
      devId = githubUserToDevId.get(commit.authorLogin.toLowerCase());
    } else if (commit.authorName && githubUserToDevId.has(commit.authorName.toLowerCase())) {
      devId = githubUserToDevId.get(commit.authorName.toLowerCase());
    }

    if (!devId) {
      devId = `dev-${devName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    }

    const key = devId;
    if (!commitsByDev.has(key)) {
      commitsByDev.set(key, { devId, devName, commits: [] });
    }
    commitsByDev.get(key)!.commits.push(commit);
  }

  const newLogs: WorkLog[] = [];

  // 4. Process each developer's commits
  for (const [, devGroup] of commitsByDev.entries()) {
    const { devId, devName, commits: devCommits } = devGroup;

    // Find developer's latest work log date
    const devLogs = existingWorkLogs.filter(
      (l) => l.developerId === devId || l.developerName.toLowerCase() === devName.toLowerCase()
    );

    let latestLogDate: string | undefined;
    if (devLogs.length > 0) {
      const sortedLogs = [...devLogs].sort((a, b) => b.date.localeCompare(a.date));
      latestLogDate = sortedLogs[0].date;
    }

    // Sort developer's commits chronologically (oldest to newest)
    const chronologicalCommits = [...devCommits].sort(
      (a, b) => new Date(a.commitDateUtc).getTime() - new Date(b.commitDateUtc).getTime()
    );

    for (let i = 0; i < chronologicalCommits.length; i++) {
      const commit = chronologicalCommits[i];
      const commitDate = formatDateInTimezone(new Date(commit.commitDateUtc), timezone);

      // Check if commit is already logged
      const shortSha = commit.shortSha?.toLowerCase() || commit.sha.slice(0, 7).toLowerCase();
      const fullSha = commit.sha.toLowerCase();
      if (loggedCommitShas.has(shortSha) || loggedCommitShas.has(fullSha)) {
        continue;
      }

      const firstLineMsg = commit.message.split("\n")[0].trim();
      const sig = `${commitDate}_${devName.toLowerCase()}_${firstLineMsg.toLowerCase()}`;
      if (loggedSignatures.has(sig)) {
        continue;
      }

      // Check if commit falls on or after latestLogDate (if latestLogDate is set)
      if (latestLogDate && commitDate < latestLogDate) {
        // Skip commits older than the latest log date window
        continue;
      }

      // Compute elapsed duration from previous commit
      const currMs = new Date(commit.commitDateUtc).getTime();
      let prevMs: number | null = null;

      if (i > 0) {
        prevMs = new Date(chronologicalCommits[i - 1].commitDateUtc).getTime();
      }

      let durationMinutes = defaultSessionMinutes;
      if (prevMs && currMs > prevMs) {
        const rawDeltaMinutes = Math.round((currMs - prevMs) / (60 * 1000));
        if (rawDeltaMinutes < minDurationMinutes) {
          durationMinutes = minDurationMinutes;
        } else if (rawDeltaMinutes > maxGapMinutes) {
          durationMinutes = defaultSessionMinutes;
        } else {
          // Round to nearest 5 minutes
          durationMinutes = Math.max(minDurationMinutes, Math.round(rawDeltaMinutes / 5) * 5);
        }
      }

      const hours = Math.round((durationMinutes / 60) * 100) / 100;

      // Resolve Project & Client
      const resolvedProj = resolveProjectByGitHubRepo(
        commit.repoOwner,
        commit.repoName,
        configuredProjects
      );

      // Infer Category & Ticket ID
      const category = inferCategoryFromCommitMessage(commit.message);
      const ticketMatch = commit.message.match(/\b([A-Z]{2,10}-\d+)\b/) || commit.branch?.match(/\b([A-Z]{2,10}-\d+)\b/);
      const taskTicketId = ticketMatch ? ticketMatch[1] : undefined;

      const logId = `log-git-${currMs}-${shortSha}`;

      const generatedLog: WorkLog = {
        id: logId,
        date: commitDate,
        developerId: devId,
        developerName: devName,
        projectId: resolvedProj.id,
        projectName: resolvedProj.name,
        client: resolvedProj.client,
        category,
        durationMinutes,
        hours,
        description: firstLineMsg,
        taskTicketId,
        sourceTab: "GIT",
        sourceRowIndex: 0,
      };

      newLogs.push(generatedLog);
      loggedCommitShas.add(shortSha);
      loggedCommitShas.add(fullSha);
      loggedSignatures.add(sig);
    }
  }

  return {
    newLogs,
    allWorkLogs: [...newLogs, ...existingWorkLogs],
    createdCount: newLogs.length,
  };
}
