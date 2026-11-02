import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { normalizeDate } from "@/lib/normalization/work-logs";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { AnalyticsSnapshot, GitHubCommit, WorkLog } from "@/types";
import { resolveCategory, resolveProject, resolveProjectByGitHubRepo, normalizeClientName } from "@/lib/mcp/resolution";
import { formatDateTimeInTimezone } from "@/lib/utils";
import { getAppEnv } from "@/lib/config/env";

const CommitWorkLogInputSchema = z.object({
  repoOwner: z.string().optional(),
  repoName: z.string().optional(),
  repoFullName: z.string().optional(),
  commitSha: z.string().min(1, "Commit SHA is required"),
  shortSha: z.string().optional(),
  branch: z.string().optional(),
  message: z.string().min(1, "Commit message is required"),
  authorName: z.string().min(1, "Author name is required"),
  authorEmail: z.string().optional(),
  commitDate: z.string().optional(),
  commitTimestamp: z.union([z.number(), z.string()]).optional(),
  previousCommitTimestamp: z.union([z.number(), z.string()]).optional(),
  category: z.string().optional(),
  client: z.string().optional(),
  project: z.string().optional(),
  taskTicketId: z.string().optional(),
  minDurationMinutes: z.number().optional().default(10),
  defaultSessionMinutes: z.number().optional().default(45),
  maxGapMinutes: z.number().optional().default(240), // 4 hours
});

function checkApiKey(req: NextRequest): boolean {
  const expectedKey = process.env.TRACKER_API_KEY;
  if (!expectedKey || !expectedKey.trim()) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const customHeader = req.headers.get("x-api-key")?.trim();

  return bearerToken === expectedKey || customHeader === expectedKey;
}

function getDefaultTodayDate(tz: string = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function parseTimestampToMs(val: number | string | undefined): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") {
    // Unix epoch seconds vs milliseconds check
    return val < 10000000000 ? val * 1000 : val;
  }
  const str = String(val).trim();
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return num < 10000000000 ? num * 1000 : num;
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? null : parsed;
}

function inferCategoryFromCommitMessage(msg: string): string {
  const clean = msg.trim().toLowerCase();
  if (/^(?:fix|bug|hotfix|patch)(?:\(.*\))?:/i.test(clean)) return "Bug Fix";
  if (/^(?:feat|feature)(?:\(.*\))?:/i.test(clean)) return "Frontend";
  if (/^(?:api|backend|db|migration|sql)(?:\(.*\))?:/i.test(clean)) return "Backend";
  if (/^(?:ui|style|design|css)(?:\(.*\))?:/i.test(clean)) return "Design";
  if (/^(?:devops|ci|cd|docker|infra|deploy)(?:\(.*\))?:/i.test(clean)) return "DevOps";
  if (/^(?:test|spec|e2e|unit)(?:\(.*\))?:/i.test(clean)) return "Testing";
  if (/^(?:doc|docs|documentation)(?:\(.*\))?:/i.test(clean)) return "Docs/Proposal";
  if (/^(?:refactor|perf|improve)(?:\(.*\))?:/i.test(clean)) return "Improvement";
  if (/^(?:review|cr)(?:\(.*\))?:/i.test(clean)) return "Review";
  return "Development";
}

export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing API key" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = CommitWorkLogInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const env = getAppEnv();
  const storage = getArtifactStorage();

  const snapshot = (await storage.readLatestAnalytics()) || {
    schemaVersion: "1.0.0",
    generatedAtUtc: new Date().toISOString(),
    displayTimezone: env.appTimezone,
    sourceStatus: "connected",
    lastSuccessfulSyncAtUtc: new Date().toISOString(),
    summary: {
      totalHours: 0,
      totalMinutes: 0,
      projectCount: 0,
      developerCount: 0,
      workLogCount: 0,
      githubCommitCount: 0,
    },
    projects: [],
    developers: [],
    categories: [],
    workLogs: [],
    githubCommits: [],
    githubRepositories: [],
    warnings: [],
  };

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  // 1. Parse repository coordinates
  let repoOwner = (data.repoOwner || "").trim();
  let repoName = (data.repoName || "").trim();

  if (data.repoFullName && data.repoFullName.includes("/")) {
    const parts = data.repoFullName.split("/");
    repoOwner = repoOwner || parts[0].trim();
    repoName = repoName || parts.slice(1).join("/").trim();
  }

  repoName = repoName.replace(/\.git$/i, "");

  // 2. Resolve Project & Client
  let resolvedProj = data.project
    ? resolveProject(data.project, data.client, settings.projects, snapshot.projects)
    : resolveProjectByGitHubRepo(repoOwner, repoName, settings.projects, snapshot.projects);

  if (data.client && data.client.trim()) {
    const explicitClient = normalizeClientName(data.client);
    if (explicitClient) {
      resolvedProj = { ...resolvedProj, client: explicitClient };
    }
  }

  // 3. Calculate Timestamps & Elapsed Duration
  const currMs = parseTimestampToMs(data.commitTimestamp) || Date.now();
  let prevMs: number | null = parseTimestampToMs(data.previousCommitTimestamp);

  if (!prevMs) {
    // Look up previous commit from storage
    if (storage.getLastCommitForAuthor) {
      const lastCommit = await storage.getLastCommitForAuthor(data.authorName, data.authorEmail);
      if (lastCommit) {
        prevMs = parseTimestampToMs(lastCommit.commitDateUtc);
      }
    }

    // Fallback: check in-memory snapshot commits
    if (!prevMs && snapshot.githubCommits && snapshot.githubCommits.length > 0) {
      const lowerName = data.authorName.toLowerCase();
      const lowerEmail = (data.authorEmail || "").toLowerCase();
      const matched = snapshot.githubCommits.filter((c) => {
        const cName = (c.authorName || "").toLowerCase();
        const cEmail = (c.authorEmail || "").toLowerCase();
        return (cName && cName === lowerName) || (lowerEmail && cEmail === lowerEmail);
      });
      if (matched.length > 0) {
        matched.sort((a, b) => new Date(b.commitDateUtc).getTime() - new Date(a.commitDateUtc).getTime());
        prevMs = parseTimestampToMs(matched[0].commitDateUtc);
      }
    }
  }

  // Duration computation with guardrails
  let durationMinutes = data.defaultSessionMinutes;
  let calculationRule = "default_session";
  let rawDeltaMinutes: number | null = null;

  if (prevMs && currMs > prevMs) {
    rawDeltaMinutes = Math.round((currMs - prevMs) / (60 * 1000));

    if (rawDeltaMinutes <= 0) {
      durationMinutes = data.minDurationMinutes;
      calculationRule = "minimum_floor_zero_delta";
    } else if (rawDeltaMinutes < data.minDurationMinutes) {
      durationMinutes = data.minDurationMinutes;
      calculationRule = "minimum_floor_micro_commit";
    } else if (rawDeltaMinutes > data.maxGapMinutes) {
      durationMinutes = data.defaultSessionMinutes;
      calculationRule = `clamped_gap_exceeded_${data.maxGapMinutes}m`;
    } else {
      // Round to nearest 5 minutes
      durationMinutes = Math.max(data.minDurationMinutes, Math.round(rawDeltaMinutes / 5) * 5);
      calculationRule = "exact_delta_from_previous_commit";
    }
  }

  const hours = Math.round((durationMinutes / 60) * 100) / 100;

  // 4. Resolve Category
  const inferredCat = data.category || inferCategoryFromCommitMessage(data.message);
  const resolvedCategory = resolveCategory(inferredCat, snapshot.categories);

  // 5. Extract Task Ticket ID
  let ticketId = data.taskTicketId?.trim();
  if (!ticketId) {
    const ticketMatch = data.message.match(/\b([A-Z]{2,10}-\d+)\b/) || (data.branch ? data.branch.match(/\b([A-Z]{2,10}-\d+)\b/) : null);
    if (ticketMatch) {
      ticketId = ticketMatch[1];
    }
  }

  // 6. Normalize work date
  let workDate: string;
  if (data.commitDate) {
    const normalized = normalizeDate(data.commitDate);
    workDate = normalized || getDefaultTodayDate(env.appTimezone);
  } else {
    try {
      workDate = formatDateTimeInTimezone(new Date(currMs).toISOString(), env.appTimezone).slice(0, 10);
    } catch {
      workDate = getDefaultTodayDate(env.appTimezone);
    }
  }

  const shortSha = data.shortSha || data.commitSha.slice(0, 7);
  const developerName = data.authorName.trim();
  const developerId = `dev-${developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  // 7. Create WorkLog
  const logId = `log-git-${Date.now()}-${shortSha}`;
  const firstLineMessage = data.message.trim().split("\n")[0];
  const newLog: WorkLog = {
    id: logId,
    date: workDate,
    developerId,
    developerName,
    projectId: resolvedProj.id,
    projectName: resolvedProj.name,
    client: resolvedProj.client,
    category: resolvedCategory,
    durationMinutes,
    hours,
    description: firstLineMessage,
    taskTicketId: ticketId || undefined,
    sourceTab: "GIT",
    sourceRowIndex: 0,
  };

  // 8. Create GitHubCommit object
  const fullRepoName = repoOwner && repoName ? `${repoOwner}/${repoName}` : repoName || "unknown-repo";
  const newCommit: GitHubCommit = {
    sha: data.commitSha,
    shortSha,
    repoOwner: repoOwner || "unknown",
    repoName: repoName || "unknown",
    repoFullName: fullRepoName,
    projectId: resolvedProj.id,
    projectName: resolvedProj.name,
    message: data.message.trim(),
    authorName: developerName,
    authorEmail: data.authorEmail || undefined,
    commitDateUtc: new Date(currMs).toISOString(),
    commitDateLocal: formatDateTimeInTimezone(new Date(currMs).toISOString(), env.appTimezone),
    commitUrl: repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}/commit/${data.commitSha}` : "",
    branch: data.branch || undefined,
    branches: data.branch ? [data.branch] : [],
    fetchedAt: new Date().toISOString(),
  };

  // 9. Update snapshot and recompute analytics
  const updatedWorkLogs = [newLog, ...(snapshot.workLogs || [])];
  
  // Deduplicate commits by repoFullName:sha
  const existingCommits = (snapshot.githubCommits || []).filter(
    (c) => !(c.repoFullName === fullRepoName && c.sha === data.commitSha)
  );
  const updatedCommits = [newCommit, ...existingCommits];

  const aggResult = computeAnalytics(
    updatedWorkLogs,
    updatedCommits,
    settings.projects,
    settings.developerGithubMapping
  );

  const updatedSnapshot: AnalyticsSnapshot = {
    ...snapshot,
    generatedAtUtc: new Date().toISOString(),
    lastSuccessfulSyncAtUtc: snapshot.lastSuccessfulSyncAtUtc || new Date().toISOString(),
    summary: aggResult.summary,
    projects: aggResult.projects,
    developers: aggResult.developers,
    categories: aggResult.categories,
    workLogs: updatedWorkLogs,
    githubCommits: updatedCommits,
    githubRepositories: aggResult.githubRepositories,
  };

  await storage.publishLatestAnalytics(updatedSnapshot);

  // Direct relational table persistence
  if (storage.insertWorkLog) {
    try {
      await storage.insertWorkLog(newLog);
    } catch (dbErr) {
      console.warn("Relational table direct insert work_log warning:", dbErr);
    }
  }

  if (storage.insertGitHubCommit) {
    try {
      await storage.insertGitHubCommit(newCommit);
    } catch (dbErr) {
      console.warn("Relational table direct insert github_commit warning:", dbErr);
    }
  }

  // Developer total today
  const devDayLogs = updatedWorkLogs.filter(
    (l) =>
      (l.developerId === developerId || l.developerName.toLowerCase() === developerName.toLowerCase()) &&
      l.date === workDate
  );
  const developerTotalHoursToday = Math.round(devDayLogs.reduce((acc, l) => acc + l.hours, 0) * 100) / 100;

  return NextResponse.json({
    success: true,
    message: `Logged ${hours}h on ${resolvedProj.name} (${resolvedProj.client}) for commit ${shortSha}`,
    workLog: newLog,
    commit: newCommit,
    calculation: {
      durationMinutes,
      hours,
      previousCommitTime: prevMs ? new Date(prevMs).toISOString() : null,
      currentCommitTime: new Date(currMs).toISOString(),
      rawDeltaMinutes,
      ruleApplied: calculationRule,
    },
    developerTotalHoursToday,
  });
}
