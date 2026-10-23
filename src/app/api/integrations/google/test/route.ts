import { NextRequest, NextResponse } from "next/server";
import { testGoogleSheetsAccess } from "@/lib/google-sheets/client";
import { getArtifactStorage } from "@/lib/storage/provider";
import { extractSpreadsheetId } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let rawInput = body.spreadsheetId;

    if (!rawInput) {
      const storage = getArtifactStorage();
      const settings = await storage.readIntegrationSettings();
      rawInput = settings?.googleSheets?.spreadsheetId;
    }

    const spreadsheetId = extractSpreadsheetId(rawInput || "");

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Please provide a Google Spreadsheet ID to test." },
        { status: 400 }
      );
    }

    const result = await testGoogleSheetsAccess(spreadsheetId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
