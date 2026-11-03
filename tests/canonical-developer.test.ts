import { describe, it, expect } from "vitest";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { WorkLog, GitHubCommit, ProjectConfig } from "@/types";

describe("Canonical Developer Resolution", () => {
  it("resolves various handles and aliases for Jay to dev-jay", () => {
    expect(resolveCanonicalDeveloper("jay")).toEqual({ id: "dev-jay", name: "Jay" });
    expect(resolveCanonicalDeveloper("jaytcdj-dev")).toEqual({ id: "dev-jay", name: "Jay" });
    expect(resolveCanonicalDeveloper("dev-jaytcdj-dev")).toEqual({ id: "dev-jay", name: "Jay" });
    expect(resolveCanonicalDeveloper("Jay Patel")).toEqual({ id: "dev-jay", name: "Jay" });
  });

  it("resolves various handles and aliases for Kaif to dev-kaif", () => {
    expect(resolveCanonicalDeveloper("khankaif")).toEqual({ id: "dev-kaif", name: "Kaif" });
    expect(resolveCanonicalDeveloper("dev-khankaif")).toEqual({ id: "dev-kaif", name: "Kaif" });
    expect(resolveCanonicalDeveloper("Kaif Khan")).toEqual({ id: "dev-kaif", name: "Kaif" });
    expect(resolveCanonicalDeveloper("dev-kaif-khan")).toEqual({ id: "dev-kaif", name: "Kaif" });
  });

  it("resolves various handles and aliases for Mahesh to dev-mahesh", () => {
    expect(resolveCanonicalDeveloper("MaheshThakur9152")).toEqual({ id: "dev-mahesh", name: "Mahesh" });
    expect(resolveCanonicalDeveloper("dev-maheshthakur9152")).toEqual({ id: "dev-mahesh", name: "Mahesh" });
    expect(resolveCanonicalDeveloper("Mahesh Thakur")).toEqual({ id: "dev-mahesh", name: "Mahesh" });
  });

  it("resolves various handles and aliases for Amol to dev-amol", () => {
    expect(resolveCanonicalDeveloper("Amol Yadav")).toEqual({ id: "dev-amol", name: "Amol" });
    expect(resolveCanonicalDeveloper("dev-amol-yadav")).toEqual({ id: "dev-amol", name: "Amol" });
    expect(resolveCanonicalDeveloper("amolyadav")).toEqual({ id: "dev-amol", name: "Amol" });
  });

  it("resolves various handles and aliases for Jemish to dev-jemish", () => {
    expect(resolveCanonicalDeveloper("jemish-vision")).toEqual({ id: "dev-jemish", name: "Jemish Sakariya" });
    expect(resolveCanonicalDeveloper("jemish sakariya")).toEqual({ id: "dev-jemish", name: "Jemish Sakariya" });
    expect(resolveCanonicalDeveloper("dev-jemish-sakariya")).toEqual({ id: "dev-jemish", name: "Jemish Sakariya" });
  });

  it("merges work logs from duplicate aliases into a single DeveloperSummary in computeAnalytics", () => {
    const logs: WorkLog[] = [
      {
        id: "log-1",
        date: "2026-10-10",
        developerId: "dev-kaif",
        developerName: "Kaif",
        projectId: "proj-1",
        projectName: "Project 1",
        category: "Development",
        durationMinutes: 120,
        hours: 2,
        description: "Initial feature",
        sourceTab: "Kaif_log",
        sourceRowIndex: 1,
      },
      {
        id: "log-2",
        date: "2026-10-15",
        developerId: "dev-khankaif",
        developerName: "khankaif",
        projectId: "proj-2",
        projectName: "Project 2",
        category: "Frontend",
        durationMinutes: 60,
        hours: 1,
        description: "Frontend tweak",
        sourceTab: "GIT",
        sourceRowIndex: 0,
      },
      {
        id: "log-3",
        date: "2026-10-20",
        developerId: "dev-kaif-khan",
        developerName: "Kaif Khan",
        projectId: "proj-1",
        projectName: "Project 1",
        category: "Development",
        durationMinutes: 60,
        hours: 1,
        description: "Fixing bugs",
        sourceTab: "Sheet",
        sourceRowIndex: 5,
      },
    ];

    const commits: GitHubCommit[] = [
      {
        sha: "abc111",
        shortSha: "abc111",
        message: "feat: something",
        authorName: "khankaif",
        authorLogin: "khankaif",
        commitDateUtc: "2026-10-15T10:00:00Z",
        commitDateLocal: "2026-10-15 15:30",
        commitUrl: "https://github.com",
        fetchedAt: "2026-10-15",
        projectId: "proj-2",
        projectName: "Project 2",
        repoOwner: "org",
        repoName: "repo",
        repoFullName: "org/repo",
      },
    ];

    const projects: ProjectConfig[] = [
      { id: "proj-1", name: "Project 1" },
      { id: "proj-2", name: "Project 2" },
    ];

    const result = computeAnalytics(logs, commits, projects);

    // Should only have 1 merged developer for Kaif
    expect(result.developers).toHaveLength(1);
    const kaif = result.developers[0];

    expect(kaif.id).toBe("dev-kaif");
    expect(kaif.name).toBe("Kaif");
    expect(kaif.totalMinutes).toBe(240); // 120 + 60 + 60
    expect(kaif.totalHours).toBe(4);
    expect(kaif.projectCount).toBe(2);
    expect(kaif.projects).toContain("Project 1");
    expect(kaif.projects).toContain("Project 2");
    expect(kaif.latestLogDate).toBe("2026-10-20");
    expect(kaif.commitCount).toBe(1);
  });
});
