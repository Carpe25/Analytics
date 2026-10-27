import { describe, it, expect, beforeEach } from "vitest";
import { ProjectService } from "@/lib/projects/project-service";
import { LocalArtifactStorage } from "@/lib/storage/local-adapter";
import { IntegrationSettings, AnalyticsSnapshot } from "@/types";
import fs from "fs";
import path from "path";

const testDir = path.resolve(process.cwd(), ".test-artifacts-projects");

describe("ProjectService Domain Isolation", () => {
  let storage: LocalArtifactStorage;
  let service: ProjectService;

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    storage = new LocalArtifactStorage(testDir);
    await storage.init();
    service = new ProjectService(storage);

    // Initial mock settings
    const initialSettings: IntegrationSettings = {
      googleSheets: {
        spreadsheetId: "test-sheet",
        tabs: [],
        columnMapping: {
          date: "Date",
          client: "Client",
          project: "Project",
          category: "Category",
          duration: "Duration",
        },
      },
      projects: [
        {
          id: "proj-cad-portal",
          name: "CAD Portal",
          code: "CAD",
          client: "Carpe Diem",
          aliases: ["CAD"],
          githubRepos: [{ owner: "Carpe25", repo: "cad-portal", defaultBranch: "main" }],
        },
      ],
      developerGithubMapping: {},
    };
    await storage.writeIntegrationSettings(initialSettings);

    // Initial mock snapshot with dynamically discovered projects
    const mockSnapshot: AnalyticsSnapshot = {
      schemaVersion: "1.0.0",
      generatedAtUtc: new Date().toISOString(),
      displayTimezone: "Asia/Kolkata",
      sourceStatus: "connected",
      summary: {
        totalHours: 10,
        totalMinutes: 600,
        projectCount: 2,
        developerCount: 1,
        workLogCount: 2,
        githubCommitCount: 0,
      },
      projects: [
        {
          id: "proj-cad-portal",
          name: "CAD Portal",
          code: "CAD",
          client: "Carpe Diem",
          totalMinutes: 300,
          totalHours: 5,
          developerCount: 1,
          logCount: 1,
          connectedRepos: ["Carpe25/cad-portal"],
          categories: ["Development"],
        },
        {
          id: "proj-univ-diam-custom-portal",
          name: "Custom Portal",
          code: "CP",
          client: "Universal Diamonds",
          totalMinutes: 300,
          totalHours: 5,
          developerCount: 1,
          logCount: 1,
          connectedRepos: [],
          categories: ["Development"],
        },
      ],
      developers: [],
      categories: [],
      workLogs: [
        {
          id: "log-1",
          developerId: "dev-kaif",
          developerName: "Kaif",
          projectId: "proj-univ-diam-custom-portal",
          projectName: "Custom Portal",
          client: "Universal Diamonds",
          date: "2026-10-27",
          durationMinutes: 300,
          hours: 5,
          category: "Development",
          description: "Portal UI work",
          sourceTab: "Kaif_log",
          sourceRowIndex: 2,
        },
      ],
      githubCommits: [],
      githubRepositories: [],
      warnings: [],
    };
    await storage.publishLatestAnalytics(mockSnapshot);
  });

  it("retrieves all projects merging configured and sheet-discovered projects", async () => {
    const all = await service.getAllProjects();
    expect(all.length).toBe(2);

    const cad = all.find((p) => p.id === "proj-cad-portal");
    expect(cad).toBeDefined();
    expect(cad?.isConfigured).toBe(true);
    expect(cad?.githubRepos.length).toBe(1);

    const customPortal = all.find((p) => p.id === "proj-univ-diam-custom-portal");
    expect(customPortal).toBeDefined();
    expect(customPortal?.isConfigured).toBe(false);
    expect(customPortal?.client).toBe("Universal Diamonds");
  });

  it("connects a repository to a dynamically discovered project by provisioning it into settings", async () => {
    const result = await service.connectRepository("proj-univ-diam-custom-portal", {
      owner: "UnivDiam",
      repo: "custom-portal-app",
      defaultBranch: "main",
    });

    expect(result.success).toBe(true);
    expect(result.project.githubRepos.length).toBe(1);
    expect(result.project.githubRepos[0].owner).toBe("UnivDiam");
    expect(result.project.githubRepos[0].repo).toBe("custom-portal-app");

    // Verify it is now persisted in integration settings
    const settings = await storage.readIntegrationSettings();
    const saved = settings?.projects.find((p) => p.id === "proj-univ-diam-custom-portal");
    expect(saved).toBeDefined();
    expect(saved?.client).toBe("Universal Diamonds");
    expect(saved?.githubRepos.length).toBe(1);
  });

  it("disconnects a repository cleanly without affecting other settings", async () => {
    // First connect
    await service.connectRepository("proj-cad-portal", {
      owner: "Carpe25",
      repo: "secondary-repo",
      defaultBranch: "develop",
    });

    let settings = await storage.readIntegrationSettings();
    let cad = settings?.projects.find((p) => p.id === "proj-cad-portal");
    expect(cad?.githubRepos.length).toBe(2);

    // Disconnect
    const result = await service.disconnectRepository("proj-cad-portal", "Carpe25", "secondary-repo");
    expect(result.success).toBe(true);

    settings = await storage.readIntegrationSettings();
    cad = settings?.projects.find((p) => p.id === "proj-cad-portal");
    expect(cad?.githubRepos.length).toBe(1);
    expect(cad?.githubRepos[0].repo).toBe("cad-portal");
  });
});
