import { WorkLog, ProjectConfig } from "@/types";
import { parseDurationToMinutes } from "./duration";

export interface RawSheetRowContext {
  spreadsheetId: string;
  tabName: string;
  rowIndex: number; // 1-indexed row number in sheet
  headers: string[];
  rowValues: any[];
  defaultDeveloperId: string;
  defaultDeveloperName: string;
}

export interface NormalizationResult {
  acceptedLogs: WorkLog[];
  ignoredCount: number;
  rejectedLogs: {
    rowIndex: number;
    tabName: string;
    rawValues: any[];
    reason: string;
  }[];
  warnings: string[];
}

/**
 * Standardizes date string to YYYY-MM-DD.
 * Handles Date objects, timestamps, Excel serial dates, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY.
 */
export function normalizeDate(val: unknown): string | null {
  if (!val) return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  const str = String(val).trim();
  if (!str) return null;

  // Already YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // DD-MM or DD/MM (e.g. 01-09, 2-9)
  const dmMatch = str.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    const year = new Date().getFullYear();
    return `${year}-${month}-${day}`;
  }

  // Try parsing with Date constructor and format in year-month-day
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Excel serial number (e.g. 45000)
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + num * 86400000);
    return date.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Finds column index by name (case-insensitive substring or exact match).
 */
export function findColumnIndex(headers: string[], targetName: string): number {
  if (!targetName) return -1;
  const target = targetName.toLowerCase().trim();
  
  // Exact match first
  const exact = headers.findIndex((h) => (h || "").toLowerCase().trim() === target);
  if (exact !== -1) return exact;

  // Substring match
  const sub = headers.findIndex((h) => (h || "").toLowerCase().trim().includes(target));
  if (sub !== -1) return sub;

  // Alphanumeric clean match (e.g. "timehours" matches "Time (Hours)")
  const cleanTarget = target.replace(/[^a-z0-9]/g, "");
  if (cleanTarget) {
    const cleanMatch = headers.findIndex((h) =>
      (h || "").toLowerCase().replace(/[^a-z0-9]/g, "").includes(cleanTarget)
    );
    if (cleanMatch !== -1) return cleanMatch;
  }

  return -1;
}

/**
 * Normalizes project name using configured projects and their aliases.
 */
export function matchProject(
  rawProject: string,
  projects: ProjectConfig[]
): { projectId: string; projectName: string } {
  const trimmed = (rawProject || "").trim();
  if (!trimmed) {
    return { projectId: "proj-unassigned", projectName: "Unassigned" };
  }

  const lower = trimmed.toLowerCase();

  for (const proj of projects) {
    if (proj.id.toLowerCase() === lower || proj.name.toLowerCase() === lower) {
      return { projectId: proj.id, projectName: proj.name };
    }
    if (proj.code && proj.code.toLowerCase() === lower) {
      return { projectId: proj.id, projectName: proj.name };
    }
    if (proj.aliases && proj.aliases.some((a) => a.toLowerCase() === lower)) {
      return { projectId: proj.id, projectName: proj.name };
    }
  }

  // Generate fallback ID
  const fallbackId = `proj-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return { projectId: fallbackId, projectName: trimmed };
}

/**
 * Normalizes raw sheet row to WorkLog
 */
export function normalizeSheetRows(
  rows: RawSheetRowContext[],
  columnMapping: {
    date: string;
    developer?: string;
    project: string;
    category: string;
    duration: string;
    description: string;
    taskTicketId?: string;
    logId?: string;
  },
  projects: ProjectConfig[]
): NormalizationResult {
  const acceptedLogs: WorkLog[] = [];
  const rejectedLogs: NormalizationResult["rejectedLogs"] = [];
  const warnings: string[] = [];
  let ignoredCount = 0;

  for (const row of rows) {
    const { headers, rowValues, rowIndex, tabName, spreadsheetId, defaultDeveloperId, defaultDeveloperName } = row;

    // Skip empty rows
    const hasValues = rowValues.some((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (!hasValues) {
      ignoredCount++;
      continue;
    }

    const dateCol = findColumnIndex(headers, columnMapping.date);
    const projCol = findColumnIndex(headers, columnMapping.project);
    const catCol = findColumnIndex(headers, columnMapping.category);
    const durCol = findColumnIndex(headers, columnMapping.duration);
    const descCol = findColumnIndex(headers, columnMapping.description);
    const ticketCol = columnMapping.taskTicketId ? findColumnIndex(headers, columnMapping.taskTicketId) : -1;
    const logIdCol = columnMapping.logId ? findColumnIndex(headers, columnMapping.logId) : -1;
    const devCol = columnMapping.developer ? findColumnIndex(headers, columnMapping.developer) : -1;

    // Check minimum required columns
    if (durCol === -1) {
      rejectedLogs.push({
        rowIndex,
        tabName,
        rawValues: rowValues,
        reason: `Duration column "${columnMapping.duration}" not found in headers: [${headers.join(", ")}]`,
      });
      continue;
    }

    const rawDuration = durCol >= 0 ? rowValues[durCol] : null;
    const durationParsed = parseDurationToMinutes(rawDuration);

    if (!durationParsed.isValid) {
      // If duration is 0 or invalid on an otherwise text header or non-log row, reject
      rejectedLogs.push({
        rowIndex,
        tabName,
        rawValues: rowValues,
        reason: durationParsed.error || "Invalid duration",
      });
      continue;
    }

    const rawDate = dateCol >= 0 ? rowValues[dateCol] : null;
    const normalizedDateStr = normalizeDate(rawDate);
    if (!normalizedDateStr) {
      rejectedLogs.push({
        rowIndex,
        tabName,
        rawValues: rowValues,
        reason: `Missing or invalid date: "${rawDate}"`,
      });
      continue;
    }

    const rawProject = projCol >= 0 ? String(rowValues[projCol] || "").trim() : "";
    const { projectId, projectName } = matchProject(rawProject, projects);

    const category = catCol >= 0 ? String(rowValues[catCol] || "").trim() || "Development" : "Development";
    const description = descCol >= 0 ? String(rowValues[descCol] || "").trim() : "";
    const taskTicketId = ticketCol >= 0 ? String(rowValues[ticketCol] || "").trim() || undefined : undefined;
    const explicitLogId = logIdCol >= 0 ? String(rowValues[logIdCol] || "").trim() : "";

    const developerName = devCol >= 0 && rowValues[devCol] ? String(rowValues[devCol]).trim() : defaultDeveloperName;
    const developerId = devCol >= 0 && rowValues[devCol] 
      ? `dev-${developerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` 
      : defaultDeveloperId;

    // Generate stable ID: explicit log ID if available, otherwise composite key
    const id = explicitLogId || `log-${tabName}-${rowIndex}-${normalizedDateStr}-${developerId}-${projectId}`;

    acceptedLogs.push({
      id,
      date: normalizedDateStr,
      developerId,
      developerName,
      projectId,
      projectName,
      category,
      durationMinutes: durationParsed.minutes,
      hours: durationParsed.hours,
      description,
      taskTicketId,
      sourceSheetId: spreadsheetId,
      sourceTab: tabName,
      sourceRowIndex: rowIndex,
    });
  }

  return {
    acceptedLogs,
    ignoredCount,
    rejectedLogs,
    warnings,
  };
}
