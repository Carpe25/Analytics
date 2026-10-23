import { getGoogleSheetsClient } from "./client";
import { RawSheetRowContext } from "@/lib/normalization/work-logs";
import { GoogleSheetsConfig } from "@/types";

export interface ReadSourcesResult {
  rows: RawSheetRowContext[];
  sourcesAttempted: string[];
  errors: string[];
  warnings: string[];
  isMockData: boolean;
}

export async function readAllGoogleSheetSources(
  config: GoogleSheetsConfig
): Promise<ReadSourcesResult> {
  const client = getGoogleSheetsClient();
  const rows: RawSheetRowContext[] = [];
  const sourcesAttempted: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // If client is null, report error (or return mock if explicitly in development mode and unconfigured)
  if (!client) {
    errors.push("Google Sheets API client is not configured (missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY)");
    return {
      rows: [],
      sourcesAttempted: [],
      errors,
      warnings,
      isMockData: false,
    };
  }

  // 1. Read tabs from main spreadsheet if spreadsheetId is configured
  if (config.spreadsheetId) {
    for (const tab of config.tabs) {
      const sourceLabel = `Sheet ${config.spreadsheetId} -> Tab "${tab.tabName}"`;
      sourcesAttempted.push(sourceLabel);
      try {
        const range = `'${tab.tabName}'!A1:Z1000`;
        const res = await client.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range,
        });

        const sheetValues = res.data.values || [];
        if (sheetValues.length <= 1) {
          warnings.push(`Tab "${tab.tabName}" has no data rows (empty or only header).`);
          continue;
        }

        const headers = sheetValues[0].map((h) => String(h || "").trim());

        for (let i = 1; i < sheetValues.length; i++) {
          rows.push({
            spreadsheetId: config.spreadsheetId,
            tabName: tab.tabName,
            rowIndex: i + 1,
            headers,
            rowValues: sheetValues[i],
            defaultDeveloperId: tab.developerId,
            defaultDeveloperName: tab.developerName,
          });
        }
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.message || "Failed to read tab";
        errors.push(`Error reading tab "${tab.tabName}": ${msg}`);
      }
    }
  }

  // 2. Read individual spreadsheets for developers if configured
  if (config.customSpreadsheets && config.customSpreadsheets.length > 0) {
    for (const custom of config.customSpreadsheets) {
      const tabName = custom.tabName || "Sheet1";
      const sourceLabel = `Custom Sheet ${custom.spreadsheetId} (${custom.developerName}) -> Tab "${tabName}"`;
      sourcesAttempted.push(sourceLabel);

      try {
        const range = `'${tabName}'!A1:Z1000`;
        const res = await client.spreadsheets.values.get({
          spreadsheetId: custom.spreadsheetId,
          range,
        });

        const sheetValues = res.data.values || [];
        if (sheetValues.length <= 1) {
          warnings.push(`Sheet for ${custom.developerName} has no data rows.`);
          continue;
        }

        const headers = sheetValues[0].map((h) => String(h || "").trim());

        for (let i = 1; i < sheetValues.length; i++) {
          rows.push({
            spreadsheetId: custom.spreadsheetId,
            tabName,
            rowIndex: i + 1,
            headers,
            rowValues: sheetValues[i],
            defaultDeveloperId: custom.developerId,
            defaultDeveloperName: custom.developerName,
          });
        }
      } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.message || "Failed to read custom sheet";
        errors.push(`Error reading custom sheet for ${custom.developerName}: ${msg}`);
      }
    }
  }

  return {
    rows,
    sourcesAttempted,
    errors,
    warnings,
    isMockData: false,
  };
}
