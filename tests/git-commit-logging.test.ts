import { describe, it, expect } from "vitest";
import { parseGitRemoteUrl } from "../mcp-server/src/git-engine";
import { resolveProjectByGitHubRepo, resolveCategory, inferCategoryFromCommitMessage } from "../src/lib/mcp/resolution";
import { ProjectConfig } from "../src/types";

describe("Git Commit Work Logging & Remote Resolution", () => {
  describe("parseGitRemoteUrl", () => {
    it("parses SSH repository URLs correctly", () => {
      const parsed = parseGitRemoteUrl("git@github.com:Carpe25/admin-portal.git");
      expect(parsed).toEqual({
        owner: "Carpe25",
        repo: "admin-portal",
        fullName: "Carpe25/admin-portal",
      });
    });

    it("parses HTTPS repository URLs correctly", () => {
      const parsed = parseGitRemoteUrl("https://github.com/Carpe25/Analytics.git");
      expect(parsed).toEqual({
        owner: "Carpe25",
        repo: "Analytics",
        fullName: "Carpe25/Analytics",
      });
    });

    it("parses tokenized HTTPS URLs correctly", () => {
      const parsed = parseGitRemoteUrl("https://x-access-token:ghp_secret@github.com/Carpe25/mobile-app");
      expect(parsed).toEqual({
        owner: "Carpe25",
        repo: "mobile-app",
        fullName: "Carpe25/mobile-app",
      });
    });

    it("returns null on empty or invalid inputs", () => {
      expect(parseGitRemoteUrl("")).toBeNull();
      expect(parseGitRemoteUrl("not-a-url")).toBeNull();
    });
  });

  describe("Connected GitHub Repo Resolution to Project and Client", () => {
    const configuredProjects: ProjectConfig[] = [
      {
        id: "proj-admin-portal",
        name: "Admin Portal",
        code: "ADM",
        client: "Carpe Diem",
        githubRepos: [
          { owner: "Carpe25", repo: "admin-portal", defaultBranch: "main" },
        ],
      },
      {
        id: "proj-cad-portal",
        name: "CAD Portal",
        code: "CAD",
        client: "Universal Diamonds",
        githubRepos: [
          { owner: "univdiamonds", repo: "cad-system", defaultBranch: "main" },
        ],
      },
    ];

    it("resolves exact repo to the connected project and its client (Admin Portal -> Carpe Diem)", () => {
      const res = resolveProjectByGitHubRepo("Carpe25", "admin-portal", configuredProjects, []);
      expect(res.id).toBe("proj-admin-portal");
      expect(res.name).toBe("Admin Portal");
      expect(res.client).toBe("Carpe Diem");
    });

    it("resolves repo with .git suffix automatically", () => {
      const res = resolveProjectByGitHubRepo("Carpe25/admin-portal.git", undefined, configuredProjects, []);
      expect(res.id).toBe("proj-admin-portal");
      expect(res.name).toBe("Admin Portal");
      expect(res.client).toBe("Carpe Diem");
    });

    it("resolves CAD system repo to Universal Diamonds client", () => {
      const res = resolveProjectByGitHubRepo("univdiamonds", "cad-system", configuredProjects, []);
      expect(res.id).toBe("proj-cad-portal");
      expect(res.name).toBe("CAD Portal");
      expect(res.client).toBe("Universal Diamonds");
    });
  });

  describe("Time Delta Calculation with Guardrails", () => {
    function computeDeltaMinutes(
      currMs: number,
      prevMs: number | null,
      options: { minDuration?: number; maxGap?: number; defaultSession?: number } = {}
    ) {
      const minDuration = options.minDuration ?? 10;
      const maxGap = options.maxGap ?? 240;
      const defaultSession = options.defaultSession ?? 45;

      if (!prevMs || currMs <= prevMs) {
        return { durationMinutes: defaultSession, rule: "default_session" };
      }

      const rawDelta = Math.round((currMs - prevMs) / (60 * 1000));
      if (rawDelta < minDuration) {
        return { durationMinutes: minDuration, rule: "minimum_floor_micro_commit" };
      }
      if (rawDelta > maxGap) {
        return { durationMinutes: defaultSession, rule: "clamped_gap_exceeded" };
      }
      return { durationMinutes: Math.round(rawDelta / 5) * 5, rule: "exact_delta_from_previous_commit" };
    }

    it("computes exact interval when commits are 45 minutes apart", () => {
      const prev = 1700000000000;
      const curr = prev + 45 * 60 * 1000;
      const res = computeDeltaMinutes(curr, prev);
      expect(res.durationMinutes).toBe(45);
      expect(res.rule).toBe("exact_delta_from_previous_commit");
    });

    it("rounds 32 minutes to 30 or 35 minutes", () => {
      const prev = 1700000000000;
      const curr = prev + 32 * 60 * 1000;
      const res = computeDeltaMinutes(curr, prev);
      expect(res.durationMinutes).toBe(30);
    });

    it("clamps overnight gap (e.g. 16 hours) to default session of 45 minutes", () => {
      const prev = 1700000000000;
      const curr = prev + 16 * 60 * 60 * 1000; // 16 hours later
      const res = computeDeltaMinutes(curr, prev);
      expect(res.durationMinutes).toBe(45);
      expect(res.rule).toBe("clamped_gap_exceeded");
    });

    it("floors rapid micro-commit (e.g. 2 minutes) to minimum floor of 10 minutes", () => {
      const prev = 1700000000000;
      const curr = prev + 2 * 60 * 1000; // 2 minutes later
      const res = computeDeltaMinutes(curr, prev);
      expect(res.durationMinutes).toBe(10);
      expect(res.rule).toBe("minimum_floor_micro_commit");
    });

    it("uses default session duration when there is no previous commit", () => {
      const curr = 1700000000000;
      const res = computeDeltaMinutes(curr, null);
      expect(res.durationMinutes).toBe(45);
      expect(res.rule).toBe("default_session");
    });
  });

  describe("Category Inference from Commit Messages", () => {
    it("maps conventional prefixes correctly", () => {
      expect(inferCategoryFromCommitMessage("feat: add admin dashboard")).toBe("Frontend");
      expect(inferCategoryFromCommitMessage("fix: resolve database lock timeout")).toBe("Bug Fix");
      expect(inferCategoryFromCommitMessage("docs: update README setup")).toBe("Docs/Proposal");
      expect(inferCategoryFromCommitMessage("test: add integration test")).toBe("Testing");
      expect(inferCategoryFromCommitMessage("devops: configure docker compose")).toBe("DevOps");
    });
  });
});
