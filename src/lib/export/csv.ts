import { WorkLog, ProjectSummary, DeveloperSummary, CategorySummary } from "@/types";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

export function exportWorkLogsToCsv(workLogs: WorkLog[]): string {
  const headers = [
    "Log ID",
    "Date",
    "Developer Name",
    "Project Name",
    "Category",
    "Hours",
    "Minutes",
    "Description",
    "Ticket ID",
    "Source Tab",
    "Source Row",
  ];

  const rows = workLogs.map((l) => [
    escapeCsvField(l.id),
    escapeCsvField(l.date),
    escapeCsvField(l.developerName),
    escapeCsvField(l.projectName),
    escapeCsvField(l.category),
    escapeCsvField(l.hours.toFixed(2)),
    escapeCsvField(l.durationMinutes),
    escapeCsvField(l.description),
    escapeCsvField(l.taskTicketId || ""),
    escapeCsvField(l.sourceTab),
    escapeCsvField(l.sourceRowIndex),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function exportProjectsToCsv(projects: ProjectSummary[]): string {
  const headers = [
    "Project ID",
    "Project Name",
    "Project Code",
    "Total Hours",
    "Developer Count",
    "Work Log Count",
    "Connected Repos",
    "Latest Activity Date",
  ];

  const rows = projects.map((p) => [
    escapeCsvField(p.id),
    escapeCsvField(p.name),
    escapeCsvField(p.code || ""),
    escapeCsvField(p.totalHours.toFixed(2)),
    escapeCsvField(p.developerCount),
    escapeCsvField(p.logCount),
    escapeCsvField(p.connectedRepos.join("; ")),
    escapeCsvField(p.latestLogDate || ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}
