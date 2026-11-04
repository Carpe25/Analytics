import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { IArtifactStorage, SyncLockInfo } from "./interface";
import { AnalyticsSnapshot, IntegrationSettings, SyncRun, WorkLog, Client } from "@/types";
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

  async insertWorkLog(log: WorkLog): Promise<void> {
    // S3 uses latest.json snapshot persistence
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

  async readClients(): Promise<Client[]> {
    try {
      const raw = await this.getObjectString("config/clients.json");
      if (raw) {
        return JSON.parse(raw) as Client[];
      }
      const settings = await this.readIntegrationSettings();
      const clientMap = new Map<string, Client>();
      const defaultSeeds = [
        { name: "Carpe Diem", code: "CD" },
        { name: "Effision", code: "EFF" },
        { name: "Univ Diam", code: "UD" },
        { name: "Level Up", code: "LU" },
        { name: "Lumen", code: "LUM" },
        { name: "Internal / Operations", code: "INT" },
      ];
      for (const d of defaultSeeds) {
        const id = `client-${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
        clientMap.set(d.name.toLowerCase(), { id, name: d.name, code: d.code });
      }
      if (settings?.projects) {
        for (const p of settings.projects) {
          if (p.client && p.client.trim()) {
            const rawClient = p.client.trim();
            if (!clientMap.has(rawClient.toLowerCase())) {
              const id = `client-${rawClient.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
              clientMap.set(rawClient.toLowerCase(), { id, name: rawClient, code: p.code });
            }
          }
        }
      }
      const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      await this.putObjectString("config/clients.json", JSON.stringify(clients, null, 2)).catch(() => {});
      return clients;
    } catch {
      return [];
    }
  }

  async saveClient(client: Client): Promise<void> {
    const clients = await this.readClients();
    const id = client.id || `client-${client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    const updatedClient: Client = {
      ...client,
      id,
      name: client.name.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: client.createdAt || new Date().toISOString(),
    };
    const index = clients.findIndex((c) => c.id === id || c.name.toLowerCase() === updatedClient.name.toLowerCase());
    if (index >= 0) {
      clients[index] = { ...clients[index], ...updatedClient };
    } else {
      clients.push(updatedClient);
    }
    clients.sort((a, b) => a.name.localeCompare(b.name));
    await this.putObjectString("config/clients.json", JSON.stringify(clients, null, 2));
  }

  async deleteClient(id: string): Promise<void> {
    const clients = await this.readClients();
    const filtered = clients.filter((c) => c.id !== id);
    await this.putObjectString("config/clients.json", JSON.stringify(filtered, null, 2));
  }

  async getMcpWorkLogs(): Promise<WorkLog[]> {
    const snap = await this.readLatestAnalytics();
    return (snap?.workLogs || []).filter((l) => l.sourceTab === "MCP");
  }
}
