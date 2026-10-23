import { describe, it, expect } from "vitest";
import { normalizeSheetRows, normalizeDate, matchProject } from "../src/lib/normalization/work-logs";

describe("Work Logs Normalization", () => {
  const dummyProjects = [
    {
      id: "proj-core",
      name: "Core Platform",
      code: "CORE",
      aliases: ["Core", "Platform"],
    },
    {
      id: "proj-ui",
      name: "Analytics UI",
      code: "AUI",
      aliases: ["Dashboard"],
    },
  ];

  it("normalizes various date formats to YYYY-MM-DD", () => {
    expect(normalizeDate("2026-10-23")).toBe("2026-10-23");
    expect(normalizeDate("23/10/2026")).toBe("2026-10-23");
    expect(normalizeDate("23-10-2026")).toBe("2026-10-23");
    expect(normalizeDate("2026/10/23")).toBe("2026-10-23");
  });

  it("resolves project names by exact name, code, or alias", () => {
    expect(matchProject("Core Platform", dummyProjects).projectId).toBe("proj-core");
    expect(matchProject("core", dummyProjects).projectId).toBe("proj-core");
    expect(matchProject("CORE", dummyProjects).projectId).toBe("proj-core");
    expect(matchProject("Dashboard", dummyProjects).projectId).toBe("proj-ui");
    
    // Unknown project
    const unknown = matchProject("Secret Project", dummyProjects);
    expect(unknown.projectId).toBe("proj-secret-project");
    expect(unknown.projectName).toBe("Secret Project");
  });

  it("handles reordered column headers correctly", () => {
    const headers = ["Description", "Hours", "Category", "Date", "Project"];
    const rows = [
      {
        spreadsheetId: "sheet-1",
        tabName: "Jay",
        rowIndex: 2,
        headers,
        rowValues: ["Refactored auth module", "2:30", "Backend", "2026-10-23", "CORE"],
        defaultDeveloperId: "dev-jay",
        defaultDeveloperName: "Jay",
      },
    ];

    const result = normalizeSheetRows(
      rows,
      {
        date: "Date",
        project: "Project",
        category: "Category",
        duration: "Hours",
        description: "Description",
      },
      dummyProjects
    );

    expect(result.acceptedLogs.length).toBe(1);
    const log = result.acceptedLogs[0];
    expect(log.date).toBe("2026-10-23");
    expect(log.durationMinutes).toBe(150);
    expect(log.hours).toBe(2.5);
    expect(log.developerName).toBe("Jay");
    expect(log.projectId).toBe("proj-core");
    expect(log.category).toBe("Backend");
    expect(log.description).toBe("Refactored auth module");
  });

  it("ignores completely empty rows without error", () => {
    const headers = ["Date", "Project", "Category", "Hours", "Description"];
    const rows = [
      {
        spreadsheetId: "sheet-1",
        tabName: "Jay",
        rowIndex: 2,
        headers,
        rowValues: ["", null, undefined, " ", ""],
        defaultDeveloperId: "dev-jay",
        defaultDeveloperName: "Jay",
      },
    ];

    const result = normalizeSheetRows(
      rows,
      {
        date: "Date",
        project: "Project",
        category: "Category",
        duration: "Hours",
        description: "Description",
      },
      dummyProjects
    );

    expect(result.acceptedLogs.length).toBe(0);
    expect(result.ignoredCount).toBe(1);
    expect(result.rejectedLogs.length).toBe(0);
  });
});
