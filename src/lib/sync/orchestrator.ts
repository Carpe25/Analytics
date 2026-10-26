import { getArtifactStorage } from "@/lib/storage/provider";
import { acquireLock, releaseLock } from "./lock";
import { readAllGoogleSheetSources } from "@/lib/google-sheets/read-sources";
import { normalizeSheetRows } from "@/lib/normalization/work-logs";
import { fetchAllProjectCommits } from "@/lib/github/commits";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { getAppEnv } from "@/lib/config/env";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { AnalyticsSnapshot, IntegrationSettings, SyncRun } from "@/types";

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
    sourcesAttempted: [],
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

    // Step 4: Read Google Sheets
    const sheetResult = await readAllGoogleSheetSources(settings.googleSheets);
    syncRun.sourcesAttempted = sheetResult.sourcesAttempted;
    syncRun.rowsRead = sheetResult.rows.length;
    if (sheetResult.errors.length > 0) {
      syncRun.errors.push(...sheetResult.errors);
    }
    if (sheetResult.warnings.length > 0) {
      syncRun.warnings.push(...sheetResult.warnings);
    }

    // Step 5 & 6: Normalize work logs
    const normResult = normalizeSheetRows(
      sheetResult.rows,
      settings.googleSheets.columnMapping,
      settings.projects
    );

    syncRun.rowsAccepted = normResult.acceptedLogs.length;
    syncRun.rowsIgnored = normResult.ignoredCount;
    syncRun.rowsRejected = normResult.rejectedLogs.length;
    syncRun.details = {
      sampleRejections: normResult.rejectedLogs.slice(0, 10).map((r) => ({
        tab: r.tabName,
        row: r.rowIndex,
        reason: r.reason,
        values: r.rawValues?.slice(0, 7),
      })),
    };
    if (normResult.warnings.length > 0) {
      syncRun.warnings.push(...normResult.warnings);
    }

    // Check if we have source errors that prevent a valid update
    if (sheetResult.errors.length > 0 && normResult.acceptedLogs.length === 0) {
      // If reading failed completely, do NOT overwrite the prior snapshot
      syncRun.status = "failed";
      syncRun.finishedAt = new Date().toISOString();
      syncRun.durationMs = Date.now() - startTime;
      await storage.appendSyncHistory(syncRun);
      await releaseLock(runId);
      return {
        run: syncRun,
        error: `Sync failed while reading Google Sheets: ${sheetResult.errors.join("; ")}`,
      };
    }

    // Step 7: Fetch GitHub commits
    const githubResult = await fetchAllProjectCommits(settings.projects);
    syncRun.commitsFetched = githubResult.commits.length;
    if (githubResult.errors.length > 0) {
      syncRun.warnings.push(...githubResult.errors);
    }
    if (githubResult.warnings.length > 0) {
      syncRun.warnings.push(...githubResult.warnings);
    }

    // Step 8: Calculate Aggregates
    const aggResult = computeAnalytics(
      normResult.acceptedLogs,
      githubResult.commits,
      settings.projects,
      settings.developerGithubMapping
    );

    // Step 9: Assemble snapshot
    const sourceStatus = sheetResult.errors.length > 0 ? "error" : "connected";

    const newSnapshot: AnalyticsSnapshot = {
      schemaVersion: "1.0.0",
      generatedAtUtc: new Date().toISOString(),
      displayTimezone: env.appTimezone,
      sourceStatus,
      lastSuccessfulSyncAtUtc: new Date().toISOString(),
      summary: aggResult.summary,
      projects: aggResult.projects,
      developers: aggResult.developers,
      categories: aggResult.categories,
      workLogs: normResult.acceptedLogs,
      githubCommits: githubResult.commits,
      githubRepositories: aggResult.githubRepositories,
      warnings: syncRun.warnings,
    };

    // Step 10 & 11: Write daily snapshot if enabled, and publish latest
    if (env.enableDailySnapshots) {
      const todayKey = new Date().toISOString().slice(0, 10);
      await storage.writeAnalyticsSnapshot(newSnapshot, todayKey);
    }

    // Atomically publish latest analytics
    await storage.publishLatestAnalytics(newSnapshot);

    // Step 12: Record success
    syncRun.status = sheetResult.errors.length > 0 || githubResult.errors.length > 0 ? "partial" : "success";
    syncRun.finishedAt = new Date().toISOString();
    syncRun.durationMs = Date.now() - startTime;
    await storage.appendSyncHistory(syncRun);

    // Step 13: Release lock
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
