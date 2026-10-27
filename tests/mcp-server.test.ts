import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrackerApiClient } from "../mcp-server/src/api-client";
import {
  handleToolCall,
  LogWorkInputSchema,
  GetMyLogsInputSchema,
  TOOLS_DEFINITIONS,
} from "../mcp-server/src/tools";

describe("MCP Server Tools and Client", () => {
  it("exposes all 4 required MCP tools with valid schemas", () => {
    const toolNames = TOOLS_DEFINITIONS.map((t) => t.name);
    expect(toolNames).toContain("log_work");
    expect(toolNames).toContain("list_projects");
    expect(toolNames).toContain("list_categories");
    expect(toolNames).toContain("get_my_logs");
    expect(TOOLS_DEFINITIONS).toHaveLength(4);
  });

  it("validates LogWorkInputSchema correctly", () => {
    // Valid input
    const valid = LogWorkInputSchema.safeParse({
      project: "CAD Portal",
      duration: "2.5h",
      category: "Frontend",
      description: "Fixed shadow map artifacts",
    });
    expect(valid.success).toBe(true);

    // Missing project
    const missingProj = LogWorkInputSchema.safeParse({
      duration: "1h",
      category: "Frontend",
      description: "Work",
    });
    expect(missingProj.success).toBe(false);

    // Missing duration
    const missingDur = LogWorkInputSchema.safeParse({
      project: "CAD",
      category: "Frontend",
      description: "Work",
    });
    expect(missingDur.success).toBe(false);
  });

  it("validates GetMyLogsInputSchema defaults", () => {
    const parsed = GetMyLogsInputSchema.parse({});
    expect(parsed.days).toBeUndefined();

    const withDays = GetMyLogsInputSchema.parse({ days: 7, developerName: "Jay" });
    expect(withDays.days).toBe(7);
    expect(withDays.developerName).toBe("Jay");
  });

  describe("handleToolCall execution with client mocking", () => {
    let mockClient: TrackerApiClient;

    beforeEach(() => {
      mockClient = {
        logWork: vi.fn().mockResolvedValue({
          success: true,
          developerTotalHoursToday: 6.5,
          message: "Logged 2.5h on CAD Portal (Frontend)! Total today: 6.5h",
          log: {
            id: "log-mcp-test-123",
            date: "2026-10-27",
            developerId: "dev-jay",
            developerName: "Jay",
            projectId: "proj-cad-portal",
            projectName: "CAD Portal",
            client: "Carpe Diem",
            category: "Frontend",
            durationMinutes: 150,
            hours: 2.5,
            description: "Fixed shader and shadow map artifacts",
            taskTicketId: "ENG-104",
          },
        }),
        listProjects: vi.fn().mockResolvedValue([
          { id: "proj-cad-portal", name: "CAD Portal", code: "CAD", client: "Carpe Diem" },
          { id: "proj-core-platform", name: "Core Platform", code: "CORE", client: "Internal / Operations" },
        ]),
        listCategories: vi.fn().mockResolvedValue(["Frontend", "Backend", "Bugs/Fix", "Review"]),
        getMyLogs: vi.fn().mockResolvedValue({
          logs: [
            {
              id: "log-1",
              date: "2026-10-27",
              projectName: "CAD Portal",
              category: "Frontend",
              hours: 2.5,
              description: "Shader fixes",
              taskTicketId: "ENG-104",
            },
          ],
          totalMinutes: 150,
          totalHours: 2.5,
          count: 1,
        }),
      } as unknown as TrackerApiClient;
    });

    it("executes log_work and formats rich confirmation output", async () => {
      const result = await handleToolCall(mockClient, "log_work", {
        project: "CAD Portal",
        duration: "2.5h",
        category: "Frontend",
        description: "Fixed shader and shadow map artifacts",
        taskTicketId: "ENG-104",
      });

      expect(mockClient.logWork).toHaveBeenCalledWith({
        project: "CAD Portal",
        duration: "2.5h",
        category: "Frontend",
        description: "Fixed shader and shadow map artifacts",
        taskTicketId: "ENG-104",
      });

      expect(result.content[0].text).toContain("CAD Portal");
      expect(result.content[0].text).toContain("2.5h (150 mins)");
      expect(result.content[0].text).toContain("ENG-104");
      expect(result.content[0].text).toContain("Developer Total Today: 6.5 hours");
    });

    it("executes list_projects and formats project listing", async () => {
      const result = await handleToolCall(mockClient, "list_projects", {});
      expect(mockClient.listProjects).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Active Projects");
      expect(result.content[0].text).toContain("CAD Portal");
      expect(result.content[0].text).toContain("Core Platform");
    });

    it("executes list_categories and formats categories", async () => {
      const result = await handleToolCall(mockClient, "list_categories", {});
      expect(mockClient.listCategories).toHaveBeenCalled();
      expect(result.content[0].text).toContain("Standard Task Categories");
      expect(result.content[0].text).toContain("Frontend");
      expect(result.content[0].text).toContain("Backend");
    });

    it("executes get_my_logs and displays formatted summary", async () => {
      const result = await handleToolCall(mockClient, "get_my_logs", { days: 1 });
      expect(mockClient.getMyLogs).toHaveBeenCalledWith(undefined, 1);
      expect(result.content[0].text).toContain("Recent Work Logs (1 entries, 2.5 total hours)");
      expect(result.content[0].text).toContain("CAD Portal");
      expect(result.content[0].text).toContain("ENG-104");
    });

    it("throws on unknown tool", async () => {
      await expect(handleToolCall(mockClient, "non_existent_tool", {})).rejects.toThrow("Unknown tool");
    });
  });
});
