import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync/orchestrator";
import { getAppEnv } from "@/lib/config/env";

export async function POST(req: NextRequest) {
  const env = getAppEnv();

  if (!env.cronSecret) {
    return NextResponse.json(
      { error: "Server configuration error: CRON_SECRET is not set." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") || req.headers.get("x-cron-secret");

  if (token !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized: Invalid CRON_SECRET token." }, { status: 401 });
  }

  try {
    const result = await runSync("scheduled");
    return NextResponse.json({
      success: result.run.status !== "failed",
      run: result.run,
      summary: result.snapshot?.summary,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
