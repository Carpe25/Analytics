import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { IntegrationSettingsSchema } from "@/lib/validation/schemas";

export async function GET() {
  const storage = getArtifactStorage();
  await storage.init();
  let settings = await storage.readIntegrationSettings();
  if (!settings) {
    settings = DEFAULT_INTEGRATION_SETTINGS;
    await storage.writeIntegrationSettings(settings);
  }
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
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
