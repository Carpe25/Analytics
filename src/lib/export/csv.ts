import { WorkLog } from "@/types";

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
