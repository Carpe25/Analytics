import { NextRequest, NextResponse } from "next/server";
import { checkConfigurationStatus } from "@/lib/config/env";
import { getArtifactStorage } from "@/lib/storage/provider";
import { getRequestAuth } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = checkConfigurationStatus();
  const storage = getArtifactStorage();
  const settings = await storage.readIntegrationSettings();

  return NextResponse.json({
    status,
    settingsConfigured: {
      hasSpreadsheetId: Boolean(settings?.googleSheets?.spreadsheetId),
      tabsCount: settings?.googleSheets?.tabs?.length || 0,
      projectsCount: settings?.projects?.length || 0,
      githubReposCount: settings?.projects?.reduce((sum, p) => sum + (p.githubRepos?.length || 0), 0) || 0,
    },
  });
}
