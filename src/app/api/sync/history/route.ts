import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { getRequestAuth, isManager } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(auth)) {
    return NextResponse.json({ error: "Forbidden: Sync history is restricted to Managers." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const storage = getArtifactStorage();
  const history = await storage.readSyncHistory(limit);
  return NextResponse.json({ history });
}
