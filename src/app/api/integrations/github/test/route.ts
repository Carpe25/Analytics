import { NextRequest, NextResponse } from "next/server";
import { testGitHubAccess } from "@/lib/github/client";

export async function POST(req: NextRequest) {
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
