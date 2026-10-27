import { describe, it, expect, beforeEach } from "vitest";
import { resolveProject, resolveCategory } from "../src/lib/mcp/resolution";
import { ProjectConfig, ProjectSummary } from "../src/types";

describe("Work Logs MCP Resolution Logic", () => {
  const mockConfigProjects: ProjectConfig[] = [
    {
      id: "proj-core-platform",
      name: "Core Platform",
      code: "CORE",
      client: "Internal / Operations",
      aliases: ["Core", "Platform", "Backend Core"],
    },
    {
      id: "proj-ring-configurator",
      name: "3D Engagement Ring Configurator",
      code: "RING",
      client: "Carpe Diem",
      aliases: ["Ring Configurator", "3D Ring"],
    },
  ];

  const mockSnapshotProjects: ProjectSummary[] = [
    {
      id: "proj-cad-portal",
      name: "CAD Portal",
      client: "Carpe Diem",
      totalMinutes: 100,
      totalHours: 1.6,
      developerCount: 1,
      logCount: 1,
      connectedRepos: [],
    },
    {
      id: "proj-medusajs",
      name: "Medusajs",
      client: "Carpe Diem",
      totalMinutes: 200,
      totalHours: 3.3,
      developerCount: 1,
      logCount: 2,
      connectedRepos: [],
    },
  ];

  describe("resolveProject", () => {
    it("resolves by exact project name and code", () => {
      const byName = resolveProject("Core Platform", mockConfigProjects, mockSnapshotProjects);
      expect(byName.id).toBe("proj-core-platform");
      expect(byName.client).toBe("Internal / Operations");

      const byCode = resolveProject("CORE", mockConfigProjects, mockSnapshotProjects);
      expect(byCode.id).toBe("proj-core-platform");

      const byCodeLower = resolveProject("ring", mockConfigProjects, mockSnapshotProjects);
      expect(byCodeLower.id).toBe("proj-ring-configurator");
    });

    it("resolves by alias", () => {
      const res = resolveProject("Backend Core", mockConfigProjects, mockSnapshotProjects);
      expect(res.id).toBe("proj-core-platform");
    });

    it("resolves snapshot projects", () => {
      const res = resolveProject("CAD Portal", mockConfigProjects, mockSnapshotProjects);
      expect(res.id).toBe("proj-cad-portal");
      expect(res.client).toBe("Carpe Diem");
    });

    it("fuzzy matches project names and tokens", () => {
      // Substring match
      const cadMatch = resolveProject("cad", mockConfigProjects, mockSnapshotProjects);
      expect(cadMatch.id).toBe("proj-cad-portal");

      // Multi-word partial match
      const ringMatch = resolveProject("ring configurator", mockConfigProjects, mockSnapshotProjects);
      expect(ringMatch.id).toBe("proj-ring-configurator");
      expect(ringMatch.name).toBe("3D Engagement Ring Configurator");
    });

    it("generates fallback project ID and infers client when unknown", () => {
      const unknown = resolveProject("Shopify Integration", mockConfigProjects, mockSnapshotProjects);
      expect(unknown.id).toBe("proj-shopify-integration");
      expect(unknown.client).toBe("Carpe Diem");
    });

    it("disambiguates projects with identical names across different clients", () => {
      const dualClientProjects: ProjectConfig[] = [
        {
          id: "proj-cd-custom-portal",
          name: "Custom Portal",
          client: "Carpe Diem",
        },
        {
          id: "proj-ud-custom-portal",
          name: "Custom Portal",
          client: "Universal Diamonds",
        },
      ];

      // Explicit client parameter
      const cdRes = resolveProject("Custom Portal", "Carpe Diem", dualClientProjects, []);
      expect(cdRes.id).toBe("proj-cd-custom-portal");
      expect(cdRes.client).toBe("Carpe Diem");

      const udRes = resolveProject("Custom Portal", "Universal Diamonds", dualClientProjects, []);
      expect(udRes.id).toBe("proj-ud-custom-portal");
      expect(udRes.client).toBe("Universal Diamonds");

      // Natural language embedded client in project string
      const cdEmbedded = resolveProject("Carpe Diem Custom Portal", undefined, dualClientProjects, []);
      expect(cdEmbedded.id).toBe("proj-cd-custom-portal");
      expect(cdEmbedded.client).toBe("Carpe Diem");

      const udEmbedded = resolveProject("UD Custom Portal", undefined, dualClientProjects, []);
      expect(udEmbedded.id).toBe("proj-ud-custom-portal");
      expect(udEmbedded.client).toBe("Universal Diamonds");
    });

    it("handles empty or blank project gracefully", () => {
      const empty = resolveProject("", undefined, mockConfigProjects, mockSnapshotProjects);
      expect(empty.id).toBe("proj-unassigned");
      expect(empty.name).toBe("Unassigned");
    });
  });

  describe("resolveCategory", () => {
    const existing = [{ name: "Bugs/Fix" }, { name: "New Feature" }, { name: "Review" }];

    it("matches exact standard categories", () => {
      expect(resolveCategory("Frontend")).toBe("Frontend");
      expect(resolveCategory("Meeting")).toBe("Meeting");
    });

    it("maps common synonyms to standard categories", () => {
      expect(resolveCategory("bug", existing)).toBe("Bugs/Fix");
      expect(resolveCategory("Bug Fix", existing)).toBe("Bug Fix");
      expect(resolveCategory("code review", existing)).toBe("Code Review");
      expect(resolveCategory("pr", existing)).toBe("Review");
      expect(resolveCategory("qa", existing)).toBe("Testing");
      expect(resolveCategory("docs", existing)).toBe("Docs/Proposal");
      expect(resolveCategory("standup", existing)).toBe("Meeting");
    });

    it("formats unmatched category with capitalization", () => {
      expect(resolveCategory("performance optimization")).toBe("Performance optimization");
    });
  });
});
