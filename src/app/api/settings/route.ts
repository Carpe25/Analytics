import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { IntegrationSettingsSchema } from "@/lib/validation/schemas";
import { getRequestAuth, isManager } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storage = getArtifactStorage();
  await storage.init();
  let settings = await storage.readIntegrationSettings();
  if (!settings) {
    settings = DEFAULT_INTEGRATION_SETTINGS;
    await storage.writeIntegrationSettings(settings);
  }

  // If user is a developer, strip sensitive infrastructure credentials
  if (!isManager(auth)) {
    return NextResponse.json({
      settings: {
        projects: settings.projects,
        clients: settings.clients || [],
        developerGithubMapping: settings.developerGithubMapping,
        googleSheets: {
          spreadsheetId: settings.googleSheets.spreadsheetId,
          tabs: settings.googleSheets.tabs.filter(
            (t) => t.developerId === auth.user?.developerId
          ),
          columnMapping: settings.googleSheets.columnMapping,
        },
      },
    });
  }

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isManager(auth)) {
    return NextResponse.json(
      { error: "Forbidden: Only Managers can modify integration settings." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const validated = IntegrationSettingsSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const storage = getArtifactStorage();
    await storage.init();
    await storage.writeIntegrationSettings(validated.data);

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
      settings: validated.data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
