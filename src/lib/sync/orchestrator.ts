import { getArtifactStorage } from "@/lib/storage/provider";
import { acquireLock, releaseLock } from "./lock";
import { fetchAllProjectCommits } from "@/lib/github/commits";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { getAppEnv } from "@/lib/config/env";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { AnalyticsSnapshot, IntegrationSettings, SyncRun, WorkLog } from "@/types";
import { generateWorkLogsFromGitHubCommits } from "./git-worklog-sync";

export interface SyncExecutionResult {
  run: SyncRun;
  snapshot?: AnalyticsSnapshot;
  error?: string;
}

export async function runSync(triggerType: "scheduled" | "manual"): Promise<SyncExecutionResult> {
  const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const storage = getArtifactStorage();
  await storage.init();

  const syncRun: SyncRun = {
    runId,
    triggerType,
    startedAt,
    status: "running",
    sourcesAttempted: ["GitHub Commits", "MCP Logs"],
    rowsRead: 0,
    rowsAccepted: 0,
    rowsUpdated: 0,
    rowsIgnored: 0,
    rowsRejected: 0,
    commitsFetched: 0,
    errors: [],
    warnings: [],
  };

  // Step 1: Acquire lock
  const locked = await acquireLock(runId);
  if (!locked) {
    const errorMsg = "Another synchronization run is currently active. Please try again after it finishes.";
    syncRun.status = "failed";
    syncRun.errors.push(errorMsg);
    syncRun.finishedAt = new Date().toISOString();
    syncRun.durationMs = Date.now() - startTime;
    await storage.appendSyncHistory(syncRun);
    return { run: syncRun, error: errorMsg };
  }

  try {
    // Step 2 & 3: Load settings
    let settings: IntegrationSettings | null = await storage.readIntegrationSettings();
    if (!settings) {
      settings = DEFAULT_INTEGRATION_SETTINGS;
      await storage.writeIntegrationSettings(settings);
    }

    const env = getAppEnv();

    // Step 4: Fetch GitHub commits across all connected repositories
    const githubResult = await fetchAllProjectCommits(settings.projects);
    syncRun.commitsFetched = githubResult.commits.length;
    if (githubResult.errors.length > 0) {
      syncRun.warnings.push(...githubResult.errors);
    }
    if (githubResult.warnings.length > 0) {
      syncRun.warnings.push(...githubResult.warnings);
    }

    // Step 5: Retrieve existing work logs (preserving MCP and historical logs)
    let existingLogs: WorkLog[] = [];
    const prevSnapshot = await storage.readLatestAnalytics();
    if (prevSnapshot?.workLogs) {
      existingLogs = [...prevSnapshot.workLogs];
    }

    if (storage.getMcpWorkLogs) {
      try {
        const mcpLogs = await storage.getMcpWorkLogs();
        const existingMap = new Map<string, WorkLog>(existingLogs.map((l) => [l.id, l]));
        for (const ml of mcpLogs) {
          existingMap.set(ml.id, ml);
        }
        existingLogs = Array.from(existingMap.values());
      } catch (mcpErr) {
        console.warn("Could not retrieve MCP logs for merging during sync:", mcpErr);
      }
    }

    // Step 6: Generate work logs from unlogged GitHub commits
    const gitWorkLogResult = generateWorkLogsFromGitHubCommits(
      githubResult.commits,
      existingLogs,
      settings.projects,
      settings.developerGithubMapping,
      { timezone: env.appTimezone }
    );

    // Persist newly generated commit work logs to relational database if supported
    if (gitWorkLogResult.newLogs.length > 0 && storage.insertWorkLog) {
      for (const nl of gitWorkLogResult.newLogs) {
        try {
          await storage.insertWorkLog(nl);
        } catch (dbErr) {
          console.warn("Could not insert git work log to database:", dbErr);
        }
      }
    }

    const allWorkLogs = gitWorkLogResult.allWorkLogs;
    syncRun.rowsRead = allWorkLogs.length;
    syncRun.rowsAccepted = allWorkLogs.length;

    // Step 7: Calculate Aggregates
    const aggResult = computeAnalytics(
      allWorkLogs,
      githubResult.commits,
      settings.projects,
      settings.developerGithubMapping
    );

    // Step 8: Assemble snapshot
    const sourceStatus = githubResult.errors.length > 0 ? "partial" : "connected";

    const newSnapshot: AnalyticsSnapshot = {
      schemaVersion: "1.0.0",
      generatedAtUtc: new Date().toISOString(),
      displayTimezone: env.appTimezone,
      sourceStatus: sourceStatus === "partial" ? "error" : "connected",
      lastSuccessfulSyncAtUtc: new Date().toISOString(),
      summary: aggResult.summary,
      projects: aggResult.projects,
      developers: aggResult.developers,
      categories: aggResult.categories,
      workLogs: allWorkLogs,
      githubCommits: githubResult.commits,
      githubRepositories: aggResult.githubRepositories,
      warnings: syncRun.warnings,
    };

    // Step 9: Write daily snapshot if enabled, and publish latest
    if (env.enableDailySnapshots) {
      const todayKey = new Date().toISOString().slice(0, 10);
      await storage.writeAnalyticsSnapshot(newSnapshot, todayKey);
    }

    // Atomically publish latest analytics
    await storage.publishLatestAnalytics(newSnapshot);

    // Step 10: Record success
    syncRun.status = githubResult.errors.length > 0 ? "partial" : "success";
    syncRun.finishedAt = new Date().toISOString();
    syncRun.durationMs = Date.now() - startTime;
    await storage.appendSyncHistory(syncRun);

    // Step 11: Release lock
    await releaseLock(runId);

    return {
      run: syncRun,
      snapshot: newSnapshot,
    };
  } catch (err: any) {
    syncRun.status = "failed";
    syncRun.errors.push(err.message || "Unexpected sync orchestration error");
    syncRun.finishedAt = new Date().toISOString();
    syncRun.durationMs = Date.now() - startTime;
    try {
      await storage.appendSyncHistory(syncRun);
    } catch {}
    await releaseLock(runId);
    return {
      run: syncRun,
      error: err.message,
    };
  }
}
