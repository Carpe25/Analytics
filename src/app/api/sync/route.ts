import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync/orchestrator";
import { getAppEnv } from "@/lib/config/env";
import { getRequestAuth, isManager } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  const env = getAppEnv();

  // Validate authorization
  const authHeader = req.headers.get("authorization");
  const secretProvided = authHeader?.replace(/^Bearer\s+/i, "") || req.headers.get("x-sync-secret");
  const hasSyncSecret = Boolean(env.manualSyncSecret && secretProvided === env.manualSyncSecret);

  if (!hasSyncSecret && !isManager(auth)) {
    return NextResponse.json(
      { error: "Forbidden: Only Managers or authorized sync callers can trigger manual synchronization." },
      { status: 403 }
    );
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
