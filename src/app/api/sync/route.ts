import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync/orchestrator";
import { getAppEnv } from "@/lib/config/env";

export async function POST(req: NextRequest) {
  const env = getAppEnv();

  // If manual sync secret is configured, require it
  if (env.manualSyncSecret) {
    const authHeader = req.headers.get("authorization");
    const secretProvided = authHeader?.replace(/^Bearer\s+/i, "") || req.headers.get("x-sync-secret");
    if (secretProvided !== env.manualSyncSecret) {
      return NextResponse.json({ error: "Unauthorized: Invalid sync secret" }, { status: 401 });
    }
  }

  try {
    const result = await runSync("manual");
    if (result.run.status === "failed") {
      return NextResponse.json(
        {
          success: false,
          run: result.run,
          error: result.error || "Sync failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      run: result.run,
      summary: result.snapshot?.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
