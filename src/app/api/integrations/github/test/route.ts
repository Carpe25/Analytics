import { NextRequest, NextResponse } from "next/server";
import { testGitHubAccess } from "@/lib/github/client";
import { getRequestAuth, isManager } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated || !isManager(auth)) {
    return NextResponse.json({ error: "Forbidden: Restricted to Managers" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { success: false, message: "Both GitHub repository owner and repository name are required." },
        { status: 400 }
      );
    }

    const result = await testGitHubAccess(owner, repo);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
