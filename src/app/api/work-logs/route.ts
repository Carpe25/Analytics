import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { parseDurationToMinutes } from "@/lib/normalization/duration";
import { normalizeDate } from "@/lib/normalization/work-logs";
import { resolveProjectClient, DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { AnalyticsSnapshot, WorkLog } from "@/types";
import { resolveProject, resolveCategory } from "@/lib/mcp/resolution";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";
import { getRequestAuth, isManager } from "@/lib/auth/guard";

const WorkLogInputSchema = z.object({
  developerName: z.string().optional(),
  developerId: z.string().optional(),
  project: z.string().min(1, "Project is required"),
  client: z.string().optional(),
  duration: z.union([z.string().min(1, "Duration cannot be empty"), z.number()]),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  taskTicketId: z.string().optional(),
  date: z.string().optional(),
});

function getDefaultTodayDate(): string {
  const tz = process.env.APP_TIMEZONE || "Asia/Kolkata";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function POST(req: NextRequest) {
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

  const parseResult = WorkLogInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { project, client, duration, category, description, taskTicketId } = parseResult.data;

  const storage = getArtifactStorage();
  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  // Resolve and enforce developer identity
  let developerName: string;
  let developerId: string;

  if (!isManager(auth) && auth.user) {
    // Authenticated developer session: strictly enforce their own credentials!
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);
    developerName = auth.user.name || authCanon.name;
    developerId = authCanon.id;

    // If caller attempted to pass someone else's developerId or name, reject with 403
    if (parseResult.data.developerId && resolveCanonicalDeveloper(parseResult.data.developerId, settings.developerGithubMapping).id !== authCanon.id) {
      return NextResponse.json(
        { error: "Forbidden: You cannot submit work logs on behalf of another developer." },
        { status: 403 }
      );
    }
    if (parseResult.data.developerName && resolveCanonicalDeveloper(parseResult.data.developerName, settings.developerGithubMapping).id !== authCanon.id) {
      return NextResponse.json(
        { error: "Forbidden: You cannot submit work logs on behalf of another developer." },
        { status: 403 }
      );
    }
  } else {
    // API key or manager
    developerName =
      parseResult.data.developerName?.trim() ||
      process.env.DEVELOPER_NAME?.trim() ||
      "Developer";

    developerId =
      parseResult.data.developerId?.trim() ||
      resolveCanonicalDeveloper(developerName, settings.developerGithubMapping).id;
  }

  // Parse duration
  const durationResult = parseDurationToMinutes(duration);
  if (!durationResult.isValid || durationResult.minutes <= 0) {
    return NextResponse.json(
      {
        error: durationResult.error || "Duration must be greater than 0 minutes",
        acceptedFormats: ["2.5h", "2h 30m", "90m", "1.5", "1:30"],
      },
      { status: 400 }
    );
  }

  // Normalize date
  let workDate: string;
  if (parseResult.data.date) {
    const normalized = normalizeDate(parseResult.data.date);
    if (!normalized) {
      return NextResponse.json(
        { error: `Invalid date format: "${parseResult.data.date}". Expected YYYY-MM-DD` },
        { status: 400 }
      );
    }
    workDate = normalized;
  } else {
    workDate = getDefaultTodayDate();
  }

  const snapshot = (await storage.readLatestAnalytics()) || {
    schemaVersion: "1.0.0",
    generatedAtUtc: new Date().toISOString(),
    displayTimezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
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

  // Resolve project and category
  const resolvedProj = resolveProject(project, client, settings.projects, snapshot.projects);
  const resolvedCat = resolveCategory(category, snapshot.categories);

  const MAX_SINGLE_WORK_LOG_MINUTES = 480; // 8 hours max per manual entry
  const finalMinutes = Math.min(durationResult.minutes, MAX_SINGLE_WORK_LOG_MINUTES);
  const finalHours = Math.round((finalMinutes / 60) * 100) / 100;

  const logId = `log-mcp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newLog: WorkLog = {
    id: logId,
    date: workDate,
    developerId,
    developerName,
    projectId: resolvedProj.id,
    projectName: resolvedProj.name,
    client: resolvedProj.client,
    category: resolvedCat,
    durationMinutes: finalMinutes,
    hours: finalHours,
    description: description.trim(),
    taskTicketId: taskTicketId?.trim() || undefined,
    sourceTab: "MCP",
    sourceRowIndex: 0,
  };

  // Add new log to snapshot and recompute analytics
  const updatedWorkLogs = [newLog, ...snapshot.workLogs];
  const aggResult = computeAnalytics(
    updatedWorkLogs,
    snapshot.githubCommits || [],
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
    githubRepositories: aggResult.githubRepositories,
  };

  // Persist snapshot to storage and re-prime RAM cache
  await storage.publishLatestAnalytics(updatedSnapshot);

  // Directly insert into relational DB table if supported
  if (storage.insertWorkLog) {
    try {
      await storage.insertWorkLog(newLog);
    } catch (dbErr) {
      console.warn("Relational table direct insert warning:", dbErr);
    }
  }

  // Optionally persist daily snapshot
  if (process.env.ENABLE_DAILY_SNAPSHOTS === "true") {
    try {
      await storage.writeAnalyticsSnapshot(updatedSnapshot, workDate);
    } catch (snapErr) {
      console.warn("Daily snapshot persist warning:", snapErr);
    }
  }

  // Calculate total hours logged by this developer on that day
  const devDayLogs = updatedWorkLogs.filter(
    (l) =>
      (l.developerId === developerId ||
        l.developerName.toLowerCase() === developerName.toLowerCase()) &&
      l.date === workDate
  );
  const totalDayMinutes = devDayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalDayHours = Number((totalDayMinutes / 60).toFixed(1));

  const confirmationMessage = `Logged ${newLog.hours}h on ${newLog.projectName} (${newLog.category})! Total today: ${totalDayHours}h (Log ID: ${newLog.id})`;

  return NextResponse.json({
    success: true,
    log: newLog,
    developerTotalHoursToday: totalDayHours,
    message: confirmationMessage,
  });
}

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized: Missing valid session token or API key" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const developerName = searchParams.get("developerName")?.trim().toLowerCase();
  const developerId = searchParams.get("developerId")?.trim().toLowerCase();
  const exactDate = searchParams.get("date")?.trim();
  const daysParam = searchParams.get("days");
  const limitParam = searchParams.get("limit");
  const projectFilter = searchParams.get("project")?.trim().toLowerCase();
  const categoryFilter = searchParams.get("category")?.trim().toLowerCase();

  const storage = getArtifactStorage();
  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  // Enforce developer account isolation: prevent viewing another developer's work logs
  if (!isManager(auth) && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping);

    if (developerId && resolveCanonicalDeveloper(developerId, settings.developerGithubMapping).id !== authCanon.id) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to access another developer's work logs." },
        { status: 403 }
      );
    }
    if (developerName && resolveCanonicalDeveloper(developerName, settings.developerGithubMapping).id !== authCanon.id) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to access another developer's work logs." },
        { status: 403 }
      );
    }
  }

  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const snapshot = await storage.readLatestAnalytics();

  if (!snapshot || !snapshot.workLogs) {
    return NextResponse.json({
      logs: [],
      totalMinutes: 0,
      totalHours: 0,
      count: 0,
    });
  }

  let filtered = [...snapshot.workLogs];

  // Developer filter
  if (!isManager(auth) && auth.user) {
    // Developers can ONLY view their own records
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings.developerGithubMapping).id;
    filtered = filtered.filter(
      (l) => resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === authCanon
    );
  } else if (developerId) {
    const targetCanon = resolveCanonicalDeveloper(developerId, settings.developerGithubMapping).id;
    filtered = filtered.filter(
      (l) => resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === targetCanon
    );
  } else if (developerName) {
    const targetCanon = resolveCanonicalDeveloper(developerName, settings.developerGithubMapping).id;
    filtered = filtered.filter(
      (l) =>
        resolveCanonicalDeveloper(l.developerId || l.developerName, settings.developerGithubMapping).id === targetCanon ||
        l.developerName.toLowerCase().includes(developerName) ||
        l.developerId.toLowerCase().includes(developerName)
    );
  }

  // Date filter
  if (exactDate) {
    filtered = filtered.filter((l) => l.date === exactDate);
  } else if (daysParam) {
    const days = parseInt(daysParam, 10);
    if (!isNaN(days) && days > 0) {
      const todayStr = getDefaultTodayDate();
      const today = new Date(todayStr);
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      filtered = filtered.filter((l) => l.date >= cutoffStr && l.date <= todayStr);
    }
  }

  // Project filter
  if (projectFilter) {
    filtered = filtered.filter(
      (l) =>
        l.projectName.toLowerCase().includes(projectFilter) ||
        l.projectId.toLowerCase().includes(projectFilter)
    );
  }

  // Category filter
  if (categoryFilter) {
    filtered = filtered.filter((l) => l.category.toLowerCase().includes(categoryFilter));
  }

  // Sort by date DESC, then id DESC
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const totalMinutes = filtered.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));

  return NextResponse.json({
    logs: filtered.slice(0, limit),
    totalMinutes,
    totalHours,
    count: filtered.length,
  });
}
