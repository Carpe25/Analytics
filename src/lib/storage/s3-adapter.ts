import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { IArtifactStorage, SyncLockInfo } from "./interface";
import { AnalyticsSnapshot, IntegrationSettings, SyncRun } from "@/types";
import { AnalyticsSnapshotSchema, IntegrationSettingsSchema } from "@/lib/validation/schemas";

export class S3ArtifactStorage implements IArtifactStorage {
  private client: S3Client;
  private bucket: string;

  constructor(options: {
    bucket: string;
    region?: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region || "us-east-1",
      endpoint: options.endpoint || undefined,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      forcePathStyle: Boolean(options.endpoint),
    });
  }

  async init(): Promise<void> {
    // S3 buckets do not need directory creation
  }

  private async getObjectString(key: string): Promise<string | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      if (!response.Body) return null;
      return await response.Body.transformToString();
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  private async putObjectString(key: string, body: string, contentType: string = "application/json"): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async readLatestAnalytics(): Promise<AnalyticsSnapshot | null> {
    try {
      const raw = await this.getObjectString("analytics/latest.json");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const validated = AnalyticsSnapshotSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data as AnalyticsSnapshot;
      }
      return null;
    } catch (err) {
      console.error("S3 readLatestAnalytics error:", err);
      return null;
    }
  }

  async publishLatestAnalytics(snapshot: AnalyticsSnapshot): Promise<void> {
    const validated = AnalyticsSnapshotSchema.parse(snapshot);
    await this.putObjectString("analytics/latest.json", JSON.stringify(validated, null, 2));
  }

  async writeAnalyticsSnapshot(snapshot: AnalyticsSnapshot, dateKey: string): Promise<void> {
    const validated = AnalyticsSnapshotSchema.parse(snapshot);
    await this.putObjectString(`analytics/snapshots/${dateKey}.json`, JSON.stringify(validated, null, 2));
  }

  async appendSyncHistory(run: SyncRun): Promise<void> {
    const existing = (await this.getObjectString("sync/history.jsonl")) || "";
    const updated = existing + JSON.stringify(run) + "\n";
    await this.putObjectString("sync/history.jsonl", updated, "application/x-ndjson");
  }

  async readSyncHistory(limit: number = 50): Promise<SyncRun[]> {
    try {
      const raw = await this.getObjectString("sync/history.jsonl");
      if (!raw) return [];
      const lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const runs: SyncRun[] = [];
      for (let i = lines.length - 1; i >= 0 && runs.length < limit; i--) {
        try {
          runs.push(JSON.parse(lines[i]));
        } catch {}
      }
      return runs;
    } catch {
      return [];
    }
  }

  async acquireSyncLock(runId: string, ttlSeconds: number = 600): Promise<boolean> {
    const key = "sync/lock.json";
    const now = new Date();
    try {
      const existing = await this.getObjectString(key);
      if (existing) {
        const lockInfo: SyncLockInfo = JSON.parse(existing);
        const expiresAt = new Date(lockInfo.expiresAtUtc);
        if (now < expiresAt) {
          return false;
        }
      }
    } catch {}

    const newLock: SyncLockInfo = {
      runId,
      lockedAtUtc: now.toISOString(),
      expiresAtUtc: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };

    await this.putObjectString(key, JSON.stringify(newLock, null, 2));
    return true;
  }

  async releaseSyncLock(runId: string): Promise<void> {
    const key = "sync/lock.json";
    try {
      const existing = await this.getObjectString(key);
      if (existing) {
        const lockInfo: SyncLockInfo = JSON.parse(existing);
        if (lockInfo.runId === runId) {
          await this.client.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: key,
            })
          );
        }
      }
    } catch {}
  }

  async readIntegrationSettings(): Promise<IntegrationSettings | null> {
    try {
      const raw = await this.getObjectString("config/settings.json");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const validated = IntegrationSettingsSchema.safeParse(parsed);
      return validated.success ? (validated.data as IntegrationSettings) : null;
    } catch {
      return null;
    }
  }

  async writeIntegrationSettings(settings: IntegrationSettings): Promise<void> {
    const validated = IntegrationSettingsSchema.parse(settings);
    await this.putObjectString("config/settings.json", JSON.stringify(validated, null, 2));
  }
}
