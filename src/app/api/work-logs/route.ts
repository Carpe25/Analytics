import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { parseDurationToMinutes } from "@/lib/normalization/duration";
import { normalizeDate } from "@/lib/normalization/work-logs";
import { resolveProjectClient, DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { AnalyticsSnapshot, WorkLog } from "@/types";
import { resolveProject, resolveCategory } from "@/lib/mcp/resolution";

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

function getDefaultTodayDate(): string {
  const tz = process.env.APP_TIMEZONE || "Asia/Kolkata";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
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

  // Resolve developer identity
  const developerName =
    parseResult.data.developerName?.trim() ||
    process.env.DEVELOPER_NAME?.trim() ||
    "Developer";

  const developerId =
    parseResult.data.developerId?.trim() ||
    `dev-${developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

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

  const storage = getArtifactStorage();
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

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  // Resolve project and category
  const resolvedProj = resolveProject(project, client, settings.projects, snapshot.projects);
  const resolvedCat = resolveCategory(category, snapshot.categories);

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
    durationMinutes: durationResult.minutes,
    hours: durationResult.hours,
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
  if (!checkApiKey(req)) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing API key" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const developerName = searchParams.get("developerName")?.trim().toLowerCase();
  const developerId = searchParams.get("developerId")?.trim().toLowerCase();
  const exactDate = searchParams.get("date")?.trim();
  const daysParam = searchParams.get("days");
  const limitParam = searchParams.get("limit");
  const projectFilter = searchParams.get("project")?.trim().toLowerCase();
  const categoryFilter = searchParams.get("category")?.trim().toLowerCase();

  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

  const storage = getArtifactStorage();
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
  if (developerId) {
    filtered = filtered.filter((l) => l.developerId.toLowerCase() === developerId);
  } else if (developerName) {
    filtered = filtered.filter(
      (l) =>
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
