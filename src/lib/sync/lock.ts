import { getArtifactStorage } from "@/lib/storage/provider";

export async function acquireLock(runId: string, ttlSeconds: number = 600): Promise<boolean> {
  const storage = getArtifactStorage();
  return await storage.acquireSyncLock(runId, ttlSeconds);
}

export async function releaseLock(runId: string): Promise<void> {
  const storage = getArtifactStorage();
  await storage.releaseSyncLock(runId);
}
