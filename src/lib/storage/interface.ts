import { AnalyticsSnapshot, IntegrationSettings, SyncRun } from "@/types";

export interface SyncLockInfo {
  runId: string;
  lockedAtUtc: string;
  expiresAtUtc: string;
}

export interface IArtifactStorage {
  init(): Promise<void>;
  readLatestAnalytics(): Promise<AnalyticsSnapshot | null>;
  publishLatestAnalytics(snapshot: AnalyticsSnapshot): Promise<void>;
  writeAnalyticsSnapshot(snapshot: AnalyticsSnapshot, dateKey: string): Promise<void>;
  appendSyncHistory(run: SyncRun): Promise<void>;
  readSyncHistory(limit?: number): Promise<SyncRun[]>;
  acquireSyncLock(runId: string, ttlSeconds?: number): Promise<boolean>;
  releaseSyncLock(runId: string): Promise<void>;
  readIntegrationSettings(): Promise<IntegrationSettings | null>;
  writeIntegrationSettings(settings: IntegrationSettings): Promise<void>;
}
