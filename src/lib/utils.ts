import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutesToHours(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) return "0.0h";
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export function formatDurationDetailed(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDateTimeInTimezone(
  isoDateStr: string | undefined | null,
  timezone: string = "Asia/Kolkata"
): string {
  if (!isoDateStr) return "Never";
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return isoDateStr;
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoDateStr;
  }
}

export function extractSpreadsheetId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    return match[1];
  }
  return trimmed;
}

export function formatMonthName(monthStr: string): string {
  if (!monthStr || monthStr === "all") return "All Months";
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

