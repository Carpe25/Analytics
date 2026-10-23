import { NextResponse } from "next/server";
import { checkConfigurationStatus } from "@/lib/config/env";
import { getArtifactStorage } from "@/lib/storage/provider";

export async function GET() {
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
