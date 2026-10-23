import { describe, it, expect } from "vitest";
import { computeAnalytics } from "../src/lib/analytics/aggregate";
import { WorkLog, GitHubCommit } from "../src/types";

describe("Analytics Aggregation", () => {
  const mockProjects = [
    { id: "proj-1", name: "Alpha", githubRepos: [{ owner: "org", repo: "alpha" }] },
    { id: "proj-2", name: "Beta", githubRepos: [] },
  ];

  const mockLogs: WorkLog[] = [
    {
      id: "log-1",
      date: "2026-10-22",
      developerId: "dev-jay",
      developerName: "Jay",
      projectId: "proj-1",
      projectName: "Alpha",
      category: "Frontend",
      durationMinutes: 120, // 2.0h
      hours: 2.0,
      description: "UI components",
      sourceTab: "Jay",
      sourceRowIndex: 2,
    },
    {
      id: "log-2",
      date: "2026-10-23",
      developerId: "dev-jay",
      developerName: "Jay",
      projectId: "proj-1",
      projectName: "Alpha",
      category: "Backend",
      durationMinutes: 60, // 1.0h
      hours: 1.0,
      description: "API endpoints",
      sourceTab: "Jay",
      sourceRowIndex: 3,
    },
    {
      id: "log-3",
      date: "2026-10-23",
      developerId: "dev-sam",
      developerName: "Sam",
      projectId: "proj-2",
      projectName: "Beta",
      category: "Frontend",
      durationMinutes: 180, // 3.0h
      hours: 3.0,
      description: "Mobile screen",
      sourceTab: "Sam",
      sourceRowIndex: 2,
    },
  ];

  const mockCommits: GitHubCommit[] = [
    {
      sha: "abcdef1234567890",
      shortSha: "abcdef1",
      repoOwner: "org",
      repoName: "alpha",
      repoFullName: "org/alpha",
      projectId: "proj-1",
      projectName: "Alpha",
      message: "feat: add auth",
      authorName: "Jay",
      authorLogin: "jaydev",
      commitDateUtc: "2026-10-23T10:00:00Z",
      commitDateLocal: "23 Oct 2026, 03:30:00 pm",
      commitUrl: "https://github.com/org/alpha/commit/abcdef1234567890",
      fetchedAt: "2026-10-23T12:00:00Z",
    },
  ];

  it("calculates overall summary totals correctly", () => {
    const result = computeAnalytics(mockLogs, mockCommits, mockProjects, {
      "dev-jay": ["jaydev"],
    });

    // Total minutes = 120 + 60 + 180 = 360 = 6.0h
    expect(result.summary.totalMinutes).toBe(360);
    expect(result.summary.totalHours).toBe(6.0);
    expect(result.summary.projectCount).toBe(2);
    expect(result.summary.developerCount).toBe(2);
    expect(result.summary.workLogCount).toBe(3);
    // Commits count is separate from hours
    expect(result.summary.githubCommitCount).toBe(1);
  });

  it("calculates developer and project hours independently from commits", () => {
    const result = computeAnalytics(mockLogs, mockCommits, mockProjects, {
      "dev-jay": ["jaydev"],
    });

    const devJay = result.developers.find((d) => d.id === "dev-jay");
    expect(devJay).toBeDefined();
    expect(devJay?.totalHours).toBe(3.0); // 120 + 60 = 180 min
    expect(devJay?.commitCount).toBe(1); // 1 commit mapped to jaydev

    const devSam = result.developers.find((d) => d.id === "dev-sam");
    expect(devSam?.totalHours).toBe(3.0);
    expect(devSam?.commitCount).toBe(0);

    const projAlpha = result.projects.find((p) => p.id === "proj-1");
    expect(projAlpha?.totalHours).toBe(3.0);
    expect(projAlpha?.developerCount).toBe(1);

    const projBeta = result.projects.find((p) => p.id === "proj-2");
    expect(projBeta?.totalHours).toBe(3.0);
  });

  it("calculates category percentages accurately", () => {
    const result = computeAnalytics(mockLogs, mockCommits, mockProjects);

    // Total 360 min. Frontend = 120 + 180 = 300 min (83.3%). Backend = 60 min (16.7%)
    const catFrontend = result.categories.find((c) => c.name === "Frontend");
    expect(catFrontend?.totalHours).toBe(5.0);
    expect(catFrontend?.percentage).toBe(83.3);

    const catBackend = result.categories.find((c) => c.name === "Backend");
    expect(catBackend?.totalHours).toBe(1.0);
    expect(catBackend?.percentage).toBe(16.7);
  });
});
