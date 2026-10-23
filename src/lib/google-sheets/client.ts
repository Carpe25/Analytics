import { google, sheets_v4 } from "googleapis";
import { getAppEnv } from "@/lib/config/env";

export function getGoogleSheetsClient(): sheets_v4.Sheets | null {
  const env = getAppEnv();

  if (env.googleAuthMode === "service_account") {
    if (!env.googleServiceAccountEmail || !env.googlePrivateKey) {
      return null;
    }

    try {
      const auth = new google.auth.JWT({
        email: env.googleServiceAccountEmail,
        key: env.googlePrivateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      return google.sheets({ version: "v4", auth });
    } catch (err) {
      console.error("Failed to initialize Google Sheets service account auth:", err);
      return null;
    }
  }

  // Fallback to API Key if set
  if (process.env.GOOGLE_API_KEY) {
    return google.sheets({ version: "v4", auth: process.env.GOOGLE_API_KEY });
  }

  return null;
}

export async function testGoogleSheetsAccess(spreadsheetId: string): Promise<{
  success: boolean;
  message: string;
  tabs?: string[];
  title?: string;
}> {
  const client = getGoogleSheetsClient();
  if (!client) {
    return {
      success: false,
      message: "Google Sheets credentials are not configured in environment variables (GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY).",
    };
  }

  if (!spreadsheetId) {
    return {
      success: false,
      message: "No spreadsheet ID provided to test.",
    };
  }

  try {
    const meta = await client.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title,sheets.properties.title",
    });

    const title = meta.data.properties?.title || "Untitled";
    const tabs = (meta.data.sheets || []).map((s) => s.properties?.title || "").filter(Boolean);

    return {
      success: true,
      message: `Successfully connected to spreadsheet "${title}" with ${tabs.length} tabs.`,
      title,
      tabs,
    };
  } catch (err: any) {
    const errorMsg = err.response?.data?.error?.message || err.message || "Unknown error";
    return {
      success: false,
      message: `Google Sheets API error: ${errorMsg}. Make sure the sheet is shared with the service account email.`,
    };
  }
}
