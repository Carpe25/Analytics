import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const storage = getArtifactStorage();
  const history = await storage.readSyncHistory(limit);
  return NextResponse.json({ history });
}
