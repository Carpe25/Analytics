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
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

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

function formatDateInTimezone(d: Date, tz: string = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function getDefaultTodayDate(tz: string = "Asia/Kolkata"): string {
  return formatDateInTimezone(new Date(), tz);
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
  try {
    const auth = await getRequestAuth(req);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized: Missing valid session token or API key" },
        { status: 401 }
      );
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

  // Enforce developer account isolation
  if (!isManager(auth) && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
    const authorCanon = resolveCanonicalDeveloper(data.authorName, settings.developerGithubMapping);

    if (authCanon.id !== authorCanon.id) {
      return NextResponse.json(
        { error: "Forbidden: You cannot log commits on behalf of another developer." },
        { status: 403 }
      );
    }
  }

  // 1. Parse repository coordinates
  let repoOwner = (data.repoOwner || "").trim();
  let repoName = (data.repoName || "").trim();

  if (data.repoFullName && data.repoFullName.includes("/")) {
    const parts = data.repoFullName.split("/");
    repoOwner = repoOwner || parts[0].trim();
    repoName = repoName || parts.slice(1).join("/").trim();
  }

  repoName = repoName.replace(/\.git$/i, "");

  // Helper: Extract explicit duration from commit message if provided: e.g. [time: 4.5h], [5h], [90m], [1.5 hrs]
  function parseDurationFromMessage(msg: string): { durationMinutes: number; cleanMessage: string } | null {
    // Matches patterns like [time: 4.5h], [time: 90m], [4h], [2.5h], [90m], [1h 30m], [1.5 hrs]
    const tagMatch = msg.match(/\[(?:time:\s*)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)(?:\s+(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?))?\]/i);
    if (!tagMatch) return null;

    const fullTag = tagMatch[0];
    const firstVal = parseFloat(tagMatch[1]);
    const firstUnit = tagMatch[2].toLowerCase();
    const secondVal = tagMatch[3] ? parseFloat(tagMatch[3]) : 0;

    let totalMinutes = 0;
    if (firstUnit.startsWith("h")) {
      totalMinutes = firstVal * 60 + secondVal;
    } else {
      totalMinutes = firstVal;
    }

    if (isNaN(totalMinutes) || totalMinutes <= 0) return null;

    // Remove the tag from commit description to keep reports clean
    const cleanMessage = msg.replace(fullTag, "").trim().replace(/\s{2,}/g, " ");
    return {
      durationMinutes: Math.round(totalMinutes),
      cleanMessage,
    };
  }

  const explicitTag = parseDurationFromMessage(data.message);

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
      const myCanon = resolveCanonicalDeveloper(data.authorName, settings.developerGithubMapping);
      const matched = snapshot.githubCommits.filter((c) => {
        const cCanon = resolveCanonicalDeveloper(c.authorLogin || c.authorName, settings.developerGithubMapping);
        return cCanon.id === myCanon.id;
      });
      if (matched.length > 0) {
        matched.sort((a, b) => new Date(b.commitDateUtc).getTime() - new Date(a.commitDateUtc).getTime());
        prevMs = parseTimestampToMs(matched[0].commitDateUtc);
      }
    }
  }

  // Duration computation with dual-tracking:
  // 1. durationMinutes: The final billable/reported minutes (subject to policy caps & validation)
  // 2. realElapsedMinutes: The exact physical git delta between commits
  // 3. claimedMinutes: What the developer requested in [time: X]
  let durationMinutes = data.defaultSessionMinutes;
  let calculationRule = "default_session";
  let rawDeltaMinutes: number | null = null;

  if (prevMs && currMs > prevMs) {
    rawDeltaMinutes = Math.round((currMs - prevMs) / (60 * 1000));
  }

  // Check if previous commit occurred on same calendar day in developer's timezone
  const currDay = formatDateInTimezone(new Date(currMs), env.appTimezone);
  const prevDay = prevMs ? formatDateInTimezone(new Date(prevMs), env.appTimezone) : null;
  const isSameDay = Boolean(prevDay && currDay === prevDay);

  // Maximum single-commit work ceiling (prevents accidental or fraudulent 10h/20h claims in a single commit)
  const MAX_SINGLE_COMMIT_CLAIM_MINUTES = 360; // 6 hours absolute max per commit
  const MAX_SAME_DAY_DELTA_MINUTES = 480; // 8 hours max delta within same day

  if (explicitTag) {
    // Developer claimed an explicit tag: e.g. [10h], [5h], [90m]
    let effectiveClaimed = explicitTag.durationMinutes;
    let clampedDueToMax = false;

    if (effectiveClaimed > MAX_SINGLE_COMMIT_CLAIM_MINUTES) {
      effectiveClaimed = MAX_SINGLE_COMMIT_CLAIM_MINUTES;
      clampedDueToMax = true;
    }

    if (rawDeltaMinutes !== null && rawDeltaMinutes < 15 && effectiveClaimed > 120) {
      // Suspicious: Developer made a commit 5 minutes after previous one but claimed large hours
      // Apply rapid commit cap after absolute ceiling
      durationMinutes = Math.min(effectiveClaimed, 60);
      calculationRule = "claimed_tag_rapid_commit_capped_60m";
    } else if (clampedDueToMax) {
      durationMinutes = MAX_SINGLE_COMMIT_CLAIM_MINUTES;
      calculationRule = `claimed_tag_clamped_max_${MAX_SINGLE_COMMIT_CLAIM_MINUTES}m`;
    } else {
      durationMinutes = effectiveClaimed;
      calculationRule = "explicit_commit_tag";
    }
  } else if (rawDeltaMinutes !== null) {
    const effectiveMaxGap = isSameDay ? MAX_SAME_DAY_DELTA_MINUTES : data.maxGapMinutes;

    if (rawDeltaMinutes <= 0) {
      durationMinutes = data.minDurationMinutes;
      calculationRule = "minimum_floor_zero_delta";
    } else if (rawDeltaMinutes < data.minDurationMinutes) {
      durationMinutes = data.minDurationMinutes;
      calculationRule = "minimum_floor_micro_commit";
    } else if (rawDeltaMinutes > effectiveMaxGap) {
      // Overnight or very long idle gap: default session applies
      durationMinutes = data.defaultSessionMinutes;
      calculationRule = `clamped_gap_exceeded_${effectiveMaxGap}m`;
    } else {
      // Normal active commit flow: round to nearest 5 minutes
      durationMinutes = Math.max(data.minDurationMinutes, Math.round(rawDeltaMinutes / 5) * 5);
      calculationRule = isSameDay ? "same_day_active_session_delta" : "exact_delta_from_previous_commit";
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
    workDate = normalized || formatDateInTimezone(new Date(currMs), env.appTimezone);
  } else {
    workDate = formatDateInTimezone(new Date(currMs), env.appTimezone);
  }

  const shortSha = data.shortSha || data.commitSha.slice(0, 7);
  let developerName = data.authorName.trim();
  let developerId = `dev-${developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  if (!isManager(auth) && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
    developerId = authCanon.id;
    developerName = auth.user.name || authCanon.name;
  } else {
    const canon = resolveCanonicalDeveloper(developerName, settings.developerGithubMapping);
    developerId = canon.id;
  }

  // 7. Create WorkLog
  const logId = `log-git-${Date.now()}-${shortSha}`;
  const effectiveMessage = explicitTag ? explicitTag.cleanMessage : data.message.trim();
  const firstLineMessage = effectiveMessage.split("\n")[0];
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
  // IDOR Protection: Prevent non-manager from overwriting a commit owned by another developer
  const existingMatchingCommit = (snapshot.githubCommits || []).find(
    (c) => c.repoFullName === fullRepoName && c.sha === data.commitSha
  );
  if (existingMatchingCommit && !isManager(auth)) {
    const existingOwnerCanon = resolveCanonicalDeveloper(
      existingMatchingCommit.authorLogin || existingMatchingCommit.authorName,
      settings.developerGithubMapping
    );
    if (existingOwnerCanon.id !== developerId) {
      return NextResponse.json(
        { error: "Forbidden: Cannot overwrite a commit that belongs to another developer." },
        { status: 403 }
      );
    }
  }

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
  } catch (err: any) {
    console.error("[/api/work-logs/commit] Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
