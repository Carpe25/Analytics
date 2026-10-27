import fs from "fs";
import path from "path";
import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { IArtifactStorage } from "./interface";
import { AnalyticsSnapshot, IntegrationSettings, SyncRun, WorkLog, GitHubCommit } from "@/types";
import { AnalyticsSnapshotSchema, IntegrationSettingsSchema } from "@/lib/validation/schemas";

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelayMs = 300): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

export class NeonArtifactStorage implements IArtifactStorage {
  private sql: NeonQueryFunction<false, false>;
  private databaseUrl: string;

  // In-memory caching for ultra-fast sub-millisecond response times
  private cachedSnapshot: AnalyticsSnapshot | null = null;
  private snapshotCachedAt: number = 0;
  private isRefreshingSnapshot: boolean = false;

  private cachedSettings: IntegrationSettings | null = null;
  private settingsCachedAt: number = 0;
  private isRefreshingSettings: boolean = false;

  private cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes TTL

  constructor(databaseUrl?: string) {
    this.databaseUrl = databaseUrl || process.env.DATABASE_URL || "";
    if (!this.databaseUrl) {
      throw new Error("DATABASE_URL is not configured for NeonArtifactStorage");
    }
    this.sql = neon(this.databaseUrl);

    // Pre-seed cache from local fallback if available to avoid cold-start delays
    this.seedFromLocalFiles();
  }

  private seedFromLocalFiles(): void {
    try {
      const localSnapshotPath = path.resolve(process.cwd(), ".artifacts", "analytics", "latest.json");
      if (fs.existsSync(localSnapshotPath)) {
        const raw = fs.readFileSync(localSnapshotPath, "utf8");
        const parsed = JSON.parse(raw);
        const validated = AnalyticsSnapshotSchema.safeParse(parsed);
        if (validated.success) {
          this.cachedSnapshot = validated.data as AnalyticsSnapshot;
          this.snapshotCachedAt = Date.now();
        }
      }
    } catch {}

    try {
      const localSettingsPath = path.resolve(process.cwd(), ".artifacts", "config", "settings.json");
      if (fs.existsSync(localSettingsPath)) {
        const raw = fs.readFileSync(localSettingsPath, "utf8");
        const parsed = JSON.parse(raw);
        const validated = IntegrationSettingsSchema.safeParse(parsed);
        if (validated.success) {
          this.cachedSettings = validated.data as IntegrationSettings;
          this.settingsCachedAt = Date.now();
        }
      }
    } catch {}
  }

  async init(): Promise<void> {
    try {
      await this.sql`
        CREATE TABLE IF NOT EXISTS sync_locks (
          id VARCHAR(64) PRIMARY KEY,
          run_id VARCHAR(128) NOT NULL,
          locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        );
      `;
    } catch (err) {
      console.warn("Could not ensure sync_locks table exists:", err);
    }
  }

  private async fetchSnapshotFromNeon(): Promise<AnalyticsSnapshot | null> {
    try {
      const rows = await this.sql`
        SELECT snapshot_json FROM analytics_snapshots
        WHERE id = 'latest'
        LIMIT 1;
      `;

      if (!rows || rows.length === 0) {
        return null;
      }

      const raw = rows[0].snapshot_json;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const validated = AnalyticsSnapshotSchema.safeParse(parsed);
      if (validated.success) {
        this.cachedSnapshot = validated.data as AnalyticsSnapshot;
        this.snapshotCachedAt = Date.now();
        return this.cachedSnapshot;
      }
      return null;
    } catch (err) {
      console.error("Error fetching latest snapshot from Neon:", err);
      return this.cachedSnapshot;
    }
  }

  async readLatestAnalytics(): Promise<AnalyticsSnapshot | null> {
    const now = Date.now();

    // Stale-while-revalidate: If we have a cached version, return it instantly!
    if (this.cachedSnapshot) {
      if (now - this.snapshotCachedAt >= this.cacheTtlMs && !this.isRefreshingSnapshot) {
        // Trigger background refresh without blocking response
        this.isRefreshingSnapshot = true;
        this.fetchSnapshotFromNeon().finally(() => {
          this.isRefreshingSnapshot = false;
        });
      }
      return this.cachedSnapshot;
    }

    // Only wait if there is zero cached data
    return await this.fetchSnapshotFromNeon();
  }

  async publishLatestAnalytics(snapshot: AnalyticsSnapshot): Promise<void> {
    const validated = AnalyticsSnapshotSchema.parse(snapshot);

    // Immediately update memory cache
    this.cachedSnapshot = validated as AnalyticsSnapshot;
    this.snapshotCachedAt = Date.now();

    // Persist snapshot JSON to Neon with retry
    await withRetry(() => this.sql`
      INSERT INTO analytics_snapshots (id, snapshot_json, updated_at)
      VALUES ('latest', ${JSON.stringify(validated)}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        snapshot_json = EXCLUDED.snapshot_json,
        updated_at = NOW();
    `);

    // Asynchronously update relational work_logs and github_commits in Neon
    this.syncRelationalTables(validated as AnalyticsSnapshot).catch((err) => {
      console.error("Error updating relational tables in Neon:", err);
    });
  }

  private async syncRelationalTables(snapshot: AnalyticsSnapshot): Promise<void> {
    try {
      if (snapshot.workLogs && snapshot.workLogs.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < snapshot.workLogs.length; i += chunkSize) {
          const chunk = snapshot.workLogs.slice(i, i + chunkSize);
          const ids = chunk.map((l) => l.id);
          const devIds = chunk.map((l) => l.developerId);
          const devNames = chunk.map((l) => l.developerName);
          const projIds = chunk.map((l) => l.projectId);
          const projNames = chunk.map((l) => l.projectName);
          const clients = chunk.map((l) => l.client || null);
          const dates = chunk.map((l) => l.date);
          const durations = chunk.map((l) => l.durationMinutes);
          const categories = chunk.map((l) => l.category);
          const descs = chunk.map((l) => l.description || "");
          const taskTicketIds = chunk.map((l) => l.taskTicketId || null);
          const statuses = chunk.map((l) => (l as any).status || null);
          const sourceTabs = chunk.map((l) => l.sourceTab || "unknown");
          const sourceRows = chunk.map((l) => l.sourceRowIndex ?? (l as any).sourceRow ?? 0);
          const rawJsons = chunk.map((l) => JSON.stringify(l));

          await withRetry(() => this.sql`
            INSERT INTO work_logs (
              id, developer_id, developer_name, project_id, project_name,
              client, date, duration_minutes, category, description,
              task_ticket_id, status, source_tab, source_row, raw_json
            )
            SELECT * FROM UNNEST(
              ${ids}::varchar[],
              ${devIds}::varchar[],
              ${devNames}::varchar[],
              ${projIds}::varchar[],
              ${projNames}::varchar[],
              ${clients}::varchar[],
              ${dates}::varchar[],
              ${durations}::int[],
              ${categories}::varchar[],
              ${descs}::text[],
              ${taskTicketIds}::varchar[],
              ${statuses}::varchar[],
              ${sourceTabs}::varchar[],
              ${sourceRows}::int[],
              ${rawJsons}::jsonb[]
            )
            ON CONFLICT (id) DO UPDATE SET
              duration_minutes = EXCLUDED.duration_minutes,
              category = EXCLUDED.category,
              description = EXCLUDED.description,
              client = EXCLUDED.client;
          `);
        }
      }

      if (snapshot.githubCommits && snapshot.githubCommits.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < snapshot.githubCommits.length; i += chunkSize) {
          const chunk = snapshot.githubCommits.slice(i, i + chunkSize);
          const ids = chunk.map((c) => `${c.repoFullName}_${c.sha}`);
          const projectIds = chunk.map((c) => c.projectId);
          const repoFullNames = chunk.map((c) => c.repoFullName);
          const shas = chunk.map((c) => c.sha);
          const shortShas = chunk.map((c) => c.shortSha);
          const messages = chunk.map((c) => c.message);
          const authorNames = chunk.map((c) => c.authorName);
          const authorLogins = chunk.map((c) => c.authorLogin || null);
          const authorEmails = chunk.map((c) => c.authorEmail || null);
          const commitDateUtcs = chunk.map((c) => c.commitDateUtc);
          const commitDateLocals = chunk.map((c) => c.commitDateLocal);
          const commitUrls = chunk.map((c) => c.commitUrl);
          const branches = chunk.map((c) => c.branch || null);
          const branchesJsons = chunk.map((c) => JSON.stringify(c.branches || []));
          const rawJsons = chunk.map((c) => JSON.stringify(c));

          await withRetry(() => this.sql`
            INSERT INTO github_commits (
              id, project_id, repo_full_name, sha, short_sha,
              message, author_name, author_login, author_email,
              commit_date_utc, commit_date_local, commit_url, branch, branches, raw_json
            )
            SELECT * FROM UNNEST(
              ${ids}::varchar[],
              ${projectIds}::varchar[],
              ${repoFullNames}::varchar[],
              ${shas}::varchar[],
              ${shortShas}::varchar[],
              ${messages}::text[],
              ${authorNames}::varchar[],
              ${authorLogins}::varchar[],
              ${authorEmails}::varchar[],
              ${commitDateUtcs}::varchar[],
              ${commitDateLocals}::varchar[],
              ${commitUrls}::varchar[],
              ${branches}::varchar[],
              ${branchesJsons}::jsonb[],
              ${rawJsons}::jsonb[]
            )
            ON CONFLICT (id) DO NOTHING;
          `);
        }
      }
    } catch (err) {
      console.warn("Non-fatal error populating relational tables:", err);
    }
  }

  async insertWorkLog(log: WorkLog): Promise<void> {
    const sourceRow = log.sourceRowIndex ?? 0;
    const sourceTab = log.sourceTab || "MCP";
    await withRetry(() => this.sql`
      INSERT INTO work_logs (
        id, developer_id, developer_name, project_id, project_name,
        client, date, duration_minutes, category, description,
        task_ticket_id, status, source_tab, source_row, raw_json
      ) VALUES (
        ${log.id}, ${log.developerId}, ${log.developerName}, ${log.projectId}, ${log.projectName},
        ${log.client || null}, ${log.date}, ${log.durationMinutes}, ${log.category}, ${log.description || ""},
        ${log.taskTicketId || null}, ${(log as any).status || null}, ${sourceTab}, ${sourceRow},
        ${JSON.stringify(log)}
      )
      ON CONFLICT (id) DO UPDATE SET
        duration_minutes = EXCLUDED.duration_minutes,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        client = EXCLUDED.client;
    `);
  }

  async getMcpWorkLogs(): Promise<WorkLog[]> {
    try {
      const rows = await withRetry(() => this.sql`
        SELECT raw_json FROM work_logs WHERE source_tab = 'MCP'
      `);
      return rows.map((r: any) =>
        typeof r.raw_json === "string" ? JSON.parse(r.raw_json) : r.raw_json
      );
    } catch (err) {
      console.warn("Could not query MCP logs from Neon relational table:", err);
      return (this.cachedSnapshot?.workLogs || []).filter((l) => l.sourceTab === "MCP");
    }
  }

  async writeAnalyticsSnapshot(snapshot: AnalyticsSnapshot, dateKey: string): Promise<void> {
    const validated = AnalyticsSnapshotSchema.parse(snapshot);
    await withRetry(() => this.sql`
      INSERT INTO analytics_snapshots (id, snapshot_json, updated_at)
      VALUES (${dateKey}, ${JSON.stringify(validated)}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        snapshot_json = EXCLUDED.snapshot_json,
        updated_at = NOW();
    `);
  }

  async appendSyncHistory(run: SyncRun): Promise<void> {
    await withRetry(() => this.sql`
      INSERT INTO sync_runs (
        run_id, trigger_type, started_at, completed_at, duration_ms,
        status, rows_read, rows_accepted, rows_ignored, rows_rejected,
        commits_fetched, sources_attempted, errors, warnings
      ) VALUES (
        ${run.runId}, ${run.triggerType}, ${run.startedAt}, ${run.finishedAt || null}, ${run.durationMs || null},
        ${run.status}, ${run.rowsRead || 0}, ${run.rowsAccepted || 0}, ${run.rowsIgnored || 0}, ${run.rowsRejected || 0},
        ${run.commitsFetched || 0}, ${JSON.stringify(run.sourcesAttempted || [])},
        ${JSON.stringify(run.errors || [])}, ${JSON.stringify(run.warnings || [])}
      )
      ON CONFLICT (run_id) DO UPDATE SET
        completed_at = EXCLUDED.completed_at,
        duration_ms = EXCLUDED.duration_ms,
        status = EXCLUDED.status,
        rows_read = EXCLUDED.rows_read,
        rows_accepted = EXCLUDED.rows_accepted,
        errors = EXCLUDED.errors,
        warnings = EXCLUDED.warnings;
    `);
  }

  async readSyncHistory(limit: number = 50): Promise<SyncRun[]> {
    try {
      const rows = await withRetry(() => this.sql`
        SELECT * FROM sync_runs
        ORDER BY started_at DESC
        LIMIT ${limit};
      `);

      return rows.map((r: any) => ({
        runId: r.run_id,
        triggerType: r.trigger_type,
        startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : r.started_at,
        finishedAt: r.completed_at instanceof Date ? r.completed_at.toISOString() : r.completed_at,
        durationMs: r.duration_ms,
        status: r.status,
        rowsRead: r.rows_read || 0,
        rowsAccepted: r.rows_accepted || 0,
        rowsUpdated: r.rows_updated || 0,
        rowsIgnored: r.rows_ignored || 0,
        rowsRejected: r.rows_rejected || 0,
        commitsFetched: r.commits_fetched || 0,
        sourcesAttempted: typeof r.sources_attempted === "string" ? JSON.parse(r.sources_attempted) : (r.sources_attempted || []),
        errors: typeof r.errors === "string" ? JSON.parse(r.errors) : (r.errors || []),
        warnings: typeof r.warnings === "string" ? JSON.parse(r.warnings) : (r.warnings || []),
      }));
    } catch (err) {
      console.error("Error reading sync history from Neon:", err);
      return [];
    }
  }

  async acquireSyncLock(runId: string, ttlSeconds: number = 600): Promise<boolean> {
    await this.init();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    try {
      // Check existing lock
      const existing = await withRetry(() => this.sql`
        SELECT * FROM sync_locks WHERE id = 'sync_lock' LIMIT 1;
      `);

      if (existing.length > 0) {
        const lock = existing[0];
        const lockExpiry = new Date(lock.expires_at);
        if (now < lockExpiry) {
          // Lock still actively held
          return false;
        }
      }

      // Upsert lock
      await withRetry(() => this.sql`
        INSERT INTO sync_locks (id, run_id, locked_at, expires_at)
        VALUES ('sync_lock', ${runId}, ${now.toISOString()}, ${expiresAt.toISOString()})
        ON CONFLICT (id) DO UPDATE SET
          run_id = EXCLUDED.run_id,
          locked_at = EXCLUDED.locked_at,
          expires_at = EXCLUDED.expires_at;
      `);
      return true;
    } catch (err) {
      console.error("Error acquiring sync lock in Neon:", err);
      return false;
    }
  }

  async releaseSyncLock(runId: string): Promise<void> {
    try {
      await withRetry(() => this.sql`
        DELETE FROM sync_locks
        WHERE id = 'sync_lock' AND run_id = ${runId};
      `);
    } catch (err) {
      console.error("Error releasing sync lock in Neon:", err);
    }
  }

  private async fetchSettingsFromNeon(): Promise<IntegrationSettings | null> {
    try {
      const rows = await this.sql`
        SELECT settings_json FROM integration_settings
        WHERE id = 'default'
        LIMIT 1;
      `;

      if (!rows || rows.length === 0) {
        return null;
      }

      const raw = rows[0].settings_json;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const validated = IntegrationSettingsSchema.safeParse(parsed);
      if (validated.success) {
        this.cachedSettings = validated.data as IntegrationSettings;
        this.settingsCachedAt = Date.now();
        return this.cachedSettings;
      }
      return null;
    } catch (err) {
      console.error("Error reading integration settings from Neon:", err);
      return this.cachedSettings;
    }
  }

  async readIntegrationSettings(): Promise<IntegrationSettings | null> {
    const now = Date.now();

    if (this.cachedSettings) {
      if (now - this.settingsCachedAt >= this.cacheTtlMs && !this.isRefreshingSettings) {
        this.isRefreshingSettings = true;
        this.fetchSettingsFromNeon().finally(() => {
          this.isRefreshingSettings = false;
        });
      }
      return this.cachedSettings;
    }

    return await this.fetchSettingsFromNeon();
  }

  async writeIntegrationSettings(settings: IntegrationSettings): Promise<void> {
    const validated = IntegrationSettingsSchema.parse(settings);
    this.cachedSettings = validated as IntegrationSettings;
    this.settingsCachedAt = Date.now();

    await withRetry(() => this.sql`
      INSERT INTO integration_settings (id, settings_json, updated_at)
      VALUES ('default', ${JSON.stringify(validated)}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        settings_json = EXCLUDED.settings_json,
        updated_at = NOW();
    `);
  }
}
