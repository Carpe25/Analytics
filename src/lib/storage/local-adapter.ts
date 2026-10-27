import fs from "fs/promises";
import path from "path";
import { IArtifactStorage, SyncLockInfo } from "./interface";
import { AnalyticsSnapshot, IntegrationSettings, SyncRun, WorkLog } from "@/types";
import { AnalyticsSnapshotSchema, IntegrationSettingsSchema } from "@/lib/validation/schemas";

export class LocalArtifactStorage implements IArtifactStorage {
  private baseDir: string;
  private lockFilePath: string;
  private latestFilePath: string;
  private historyFilePath: string;
  private settingsFilePath: string;

  constructor(baseDir: string = ".artifacts") {
    this.baseDir = path.isAbsolute(baseDir) ? baseDir : path.resolve(process.cwd(), baseDir);
    this.lockFilePath = path.join(this.baseDir, "sync", "lock.json");
    this.latestFilePath = path.join(this.baseDir, "analytics", "latest.json");
    this.historyFilePath = path.join(this.baseDir, "sync", "history.jsonl");
    this.settingsFilePath = path.join(this.baseDir, "config", "settings.json");
  }

  async init(): Promise<void> {
    await fs.mkdir(path.join(this.baseDir, "analytics", "snapshots"), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, "sync"), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, "config"), { recursive: true });
  }

  private async atomicWrite(targetPath: string, content: string): Promise<void> {
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    await fs.writeFile(tempPath, content, "utf8");
    await fs.rename(tempPath, targetPath);
  }

  async readLatestAnalytics(): Promise<AnalyticsSnapshot | null> {
    try {
      const data = await fs.readFile(this.latestFilePath, "utf8");
      const parsed = JSON.parse(data);
      const validated = AnalyticsSnapshotSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data as AnalyticsSnapshot;
      }
      console.warn("Invalid snapshot schema in latest.json:", validated.error);
      return null;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return null;
      }
      console.error("Error reading latest analytics artifact:", err);
      return null;
    }
  }

  async publishLatestAnalytics(snapshot: AnalyticsSnapshot): Promise<void> {
    const validated = AnalyticsSnapshotSchema.parse(snapshot);
    const content = JSON.stringify(validated, null, 2);
    // Verify JSON before writing
    JSON.parse(content);
    await this.atomicWrite(this.latestFilePath, content);
  }

  async insertWorkLog(log: WorkLog): Promise<void> {
    // Snapshot-based storage handles persistence in publishLatestAnalytics
  }

  async writeAnalyticsSnapshot(snapshot: AnalyticsSnapshot, dateKey: string): Promise<void> {
    const validated = AnalyticsSnapshotSchema.parse(snapshot);
    const snapshotPath = path.join(this.baseDir, "analytics", "snapshots", `${dateKey}.json`);
    await this.atomicWrite(snapshotPath, JSON.stringify(validated, null, 2));
  }

  async appendSyncHistory(run: SyncRun): Promise<void> {
    const line = JSON.stringify(run) + "\n";
    const dir = path.dirname(this.historyFilePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(this.historyFilePath, line, "utf8");
  }

  async readSyncHistory(limit: number = 50): Promise<SyncRun[]> {
    try {
      const data = await fs.readFile(this.historyFilePath, "utf8");
      const lines = data
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      
      const runs: SyncRun[] = [];
      for (let i = lines.length - 1; i >= 0 && runs.length < limit; i--) {
        try {
          const run = JSON.parse(lines[i]);
          runs.push(run);
        } catch {}
      }
      return runs;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return [];
      }
      console.error("Error reading sync history:", err);
      return [];
    }
  }

  async acquireSyncLock(runId: string, ttlSeconds: number = 600): Promise<boolean> {
    await this.init();
    const now = new Date();
    try {
      const existingData = await fs.readFile(this.lockFilePath, "utf8");
      const lockInfo: SyncLockInfo = JSON.parse(existingData);
      const expiresAt = new Date(lockInfo.expiresAtUtc);
      if (now < expiresAt) {
        // Lock is still actively held
        return false;
      }
    } catch {
      // Lock doesn't exist or is invalid
    }

    const newLock: SyncLockInfo = {
      runId,
      lockedAtUtc: now.toISOString(),
      expiresAtUtc: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };

    try {
      await this.atomicWrite(this.lockFilePath, JSON.stringify(newLock, null, 2));
      return true;
    } catch (err) {
      console.error("Failed to acquire lock:", err);
      return false;
    }
  }

  async releaseSyncLock(runId: string): Promise<void> {
    try {
      const existingData = await fs.readFile(this.lockFilePath, "utf8");
      const lockInfo: SyncLockInfo = JSON.parse(existingData);
      if (lockInfo.runId === runId) {
        await fs.unlink(this.lockFilePath);
      }
    } catch {
      // Lock already removed or file missing
    }
  }

  async readIntegrationSettings(): Promise<IntegrationSettings | null> {
    try {
      const data = await fs.readFile(this.settingsFilePath, "utf8");
      const parsed = JSON.parse(data);
      const validated = IntegrationSettingsSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data as IntegrationSettings;
      }
      return null;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return null;
      }
      console.error("Error reading integration settings:", err);
      return null;
    }
  }

  async writeIntegrationSettings(settings: IntegrationSettings): Promise<void> {
    const validated = IntegrationSettingsSchema.parse(settings);
    await this.atomicWrite(this.settingsFilePath, JSON.stringify(validated, null, 2));
  }

  async getMcpWorkLogs(): Promise<WorkLog[]> {
    const snap = await this.readLatestAnalytics();
    return (snap?.workLogs || []).filter((l) => l.sourceTab === "MCP");
  }
}
