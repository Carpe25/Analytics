import { NextResponse } from "next/server";
import { checkConfigurationStatus } from "@/lib/config/env";
import { getArtifactStorage } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const config = checkConfigurationStatus();
  const storage = getArtifactStorage();
  let latestSnapshotExists = false;
  let lastSyncAt: string | undefined;

  try {
    const latest = await storage.readLatestAnalytics();
    if (latest) {
      latestSnapshotExists = true;
      lastSyncAt = latest.lastSuccessfulSyncAtUtc;
    }
  } catch {}

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config,
    storage: {
      hasLatestSnapshot: latestSnapshotExists,
      lastSuccessfulSyncAtUtc: lastSyncAt,
    },
  });
}
