import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import { LocalArtifactStorage } from "../src/lib/storage/local-adapter";

describe("Local Artifact Storage & Sync Locking", () => {
  const testDir = path.resolve(process.cwd(), ".test-artifacts");
  let storage: LocalArtifactStorage;

  beforeEach(async () => {
    storage = new LocalArtifactStorage(testDir);
    await storage.init();
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("acquires and prevents concurrent sync lock acquisition", async () => {
    const run1 = "run-test-1";
    const run2 = "run-test-2";

    const acquired1 = await storage.acquireSyncLock(run1, 60);
    expect(acquired1).toBe(true);

    // Second concurrent run cannot acquire
    const acquired2 = await storage.acquireSyncLock(run2, 60);
    expect(acquired2).toBe(false);

    // Release lock from run1
    await storage.releaseSyncLock(run1);

    // Now run2 can acquire
    const acquiredAfterRelease = await storage.acquireSyncLock(run2, 60);
    expect(acquiredAfterRelease).toBe(true);

    await storage.releaseSyncLock(run2);
  });

  it("appends and reads sync history in reverse chronological order", async () => {
    await storage.appendSyncHistory({
      runId: "run-first",
      triggerType: "manual",
      startedAt: new Date(Date.now() - 5000).toISOString(),
      status: "success",
      sourcesAttempted: ["Sheet 1"],
      rowsRead: 10,
      rowsAccepted: 10,
      rowsUpdated: 0,
      rowsIgnored: 0,
      rowsRejected: 0,
      commitsFetched: 5,
      errors: [],
      warnings: [],
    });

    await storage.appendSyncHistory({
      runId: "run-second",
      triggerType: "scheduled",
      startedAt: new Date().toISOString(),
      status: "success",
      sourcesAttempted: ["Sheet 1"],
      rowsRead: 12,
      rowsAccepted: 12,
      rowsUpdated: 0,
      rowsIgnored: 0,
      rowsRejected: 0,
      commitsFetched: 8,
      errors: [],
      warnings: [],
    });

    const history = await storage.readSyncHistory(10);
    expect(history.length).toBe(2);
    expect(history[0].runId).toBe("run-second");
    expect(history[1].runId).toBe("run-first");
  });
});
