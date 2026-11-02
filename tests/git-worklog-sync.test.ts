import { describe, it, expect } from "vitest";
import { generateWorkLogsFromGitHubCommits } from "@/lib/sync/git-worklog-sync";
import { GitHubCommit, ProjectConfig, WorkLog } from "@/types";

describe("generateWorkLogsFromGitHubCommits", () => {
  const mockProjects: ProjectConfig[] = [
    {
      id: "proj-admin-portal",
      name: "admin-portal",
      code: "AP",
      client: "Carpe Diem",
      aliases: ["admin portal", "admin"],
      githubRepos: [
        {
          owner: "Carpe25",
          repo: "admin-portal",
          defaultBranch: "main",
        },
      ],
    },
  ];

  const mockDevMapping = {
    "dev-jay": ["jaypatel", "Jay Patel"],
  };

  const existingWorkLogs: WorkLog[] = [
    {
      id: "log-1",
      date: "2026-10-31",
      developerId: "dev-jay",
      developerName: "Jay Patel",
      projectId: "proj-admin-portal",
      projectName: "admin-portal",
      client: "Carpe Diem",
      category: "Feature",
      durationMinutes: 60,
      hours: 1,
      description: "Setup project structure",
      sourceTab: "Sheet",
      sourceRowIndex: 2,
    },
  ];

  it("filters commits before developer's latest log date and includes commits on or after it", () => {
    const commits: GitHubCommit[] = [
      {
        sha: "1111111111111111111111111111111111111111",
        shortSha: "1111111",
        message: "Old commit before last log date",
        authorName: "Jay Patel",
        authorLogin: "jaypatel",
        authorEmail: "jay@example.com",
        commitDateUtc: "2026-10-25T10:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
      {
        sha: "2222222222222222222222222222222222222222",
        shortSha: "2222222",
        message: "feat: work on 2026-11-01",
        authorName: "Jay Patel",
        authorLogin: "jaypatel",
        authorEmail: "jay@example.com",
        commitDateUtc: "2026-11-01T10:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
      {
        sha: "3333333333333333333333333333333333333333",
        shortSha: "3333333",
        message: "fix: work on 2026-11-02",
        authorName: "Jay Patel",
        authorLogin: "jaypatel",
        authorEmail: "jay@example.com",
        commitDateUtc: "2026-11-02T12:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
    ];

    const result = generateWorkLogsFromGitHubCommits(
      commits,
      existingWorkLogs,
      mockProjects,
      mockDevMapping
    );

    // Commit 1111111 is 2026-10-25 (before 2026-10-31), so it should be skipped.
    // Commits 2222222 (2026-11-01) and 3333333 (2026-11-02) should be included.
    expect(result.createdCount).toBe(2);
    expect(result.newLogs).toHaveLength(2);

    expect(result.newLogs[0].description).toBe("feat: work on 2026-11-01");
    expect(result.newLogs[0].date).toBe("2026-11-01");
    expect(result.newLogs[0].client).toBe("Carpe Diem");
    expect(result.newLogs[0].projectName).toBe("admin-portal");
    expect(result.newLogs[0].category).toBe("Frontend");
    expect(result.newLogs[0].sourceTab).toBe("GIT");

    expect(result.newLogs[1].description).toBe("fix: work on 2026-11-02");
    expect(result.newLogs[1].date).toBe("2026-11-02");
    expect(result.newLogs[1].category).toBe("Bug Fix");
  });

  it("avoids duplicate entries for already logged commits", () => {
    const alreadyLogged: WorkLog = {
      id: "log-git-1793630563177-dcd04c2",
      date: "2026-11-02",
      developerId: "dev-jay",
      developerName: "Jay Patel",
      projectId: "proj-admin-portal",
      projectName: "admin-portal",
      client: "Carpe Diem",
      category: "Feature",
      durationMinutes: 45,
      hours: 0.75,
      description: "feat: implemented automatic commit sync",
      sourceTab: "GIT",
      sourceRowIndex: 0,
    };

    const commits: GitHubCommit[] = [
      {
        sha: "dcd04c21234567890abcdef1234567890abcdef1",
        shortSha: "dcd04c2",
        message: "feat: implemented automatic commit sync",
        authorName: "Jay Patel",
        authorLogin: "jaypatel",
        authorEmail: "jay@example.com",
        commitDateUtc: "2026-11-02T14:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
      {
        sha: "abc99991234567890abcdef1234567890abcdef1",
        shortSha: "abc9999",
        message: "docs: update readme with setup instructions",
        authorName: "Jay Patel",
        authorLogin: "jaypatel",
        authorEmail: "jay@example.com",
        commitDateUtc: "2026-11-02T15:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
    ];

    const result = generateWorkLogsFromGitHubCommits(
      commits,
      [alreadyLogged],
      mockProjects,
      mockDevMapping
    );

    // Only abc9999 should be created; dcd04c2 should be recognized as already logged
    expect(result.createdCount).toBe(1);
    expect(result.newLogs[0].id).toContain("abc9999");
    expect(result.newLogs[0].description).toBe("docs: update readme with setup instructions");
  });

  it("calculates time intervals correctly between chronological commits", () => {
    const commits: GitHubCommit[] = [
      {
        sha: "aaa1111111111111111111111111111111111111",
        shortSha: "aaa1111",
        message: "Commit 1",
        authorName: "Jay Patel",
        commitDateUtc: "2026-11-02T10:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
      {
        sha: "bbb2222222222222222222222222222222222222",
        shortSha: "bbb2222",
        message: "Commit 2 (35 mins later)",
        authorName: "Jay Patel",
        commitDateUtc: "2026-11-02T10:35:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
      {
        sha: "ccc3333333333333333333333333333333333333",
        shortSha: "ccc3333",
        message: "Commit 3 (3 mins later - under min duration)",
        authorName: "Jay Patel",
        commitDateUtc: "2026-11-02T10:38:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
      {
        sha: "ddd4444444444444444444444444444444444444",
        shortSha: "ddd4444",
        message: "Commit 4 (6 hours later - over max gap)",
        authorName: "Jay Patel",
        commitDateUtc: "2026-11-02T16:38:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
    ];

    const result = generateWorkLogsFromGitHubCommits(commits, [], mockProjects, mockDevMapping);

    expect(result.createdCount).toBe(4);
    // Commit 1: first in session -> default 45m
    expect(result.newLogs[0].durationMinutes).toBe(45);
    // Commit 2: 35 minutes -> 35m
    expect(result.newLogs[1].durationMinutes).toBe(35);
    // Commit 3: 3 mins -> clamped to min duration 10m
    expect(result.newLogs[2].durationMinutes).toBe(10);
    // Commit 4: 6 hours (> 4 hrs max gap) -> resets to default 45m
    expect(result.newLogs[3].durationMinutes).toBe(45);
  });

  it("extracts task ticket IDs from commit messages and resolves connected project client", () => {
    const commits: GitHubCommit[] = [
      {
        sha: "eee5555555555555555555555555555555555555",
        shortSha: "eee5555",
        message: "feat(CARPE-402): implement client portal security",
        authorName: "Jay Patel",
        commitDateUtc: "2026-11-02T11:00:00Z",
        repoOwner: "Carpe25",
        repoName: "admin-portal",
        repoFullName: "Carpe25/admin-portal",
      },
    ];

    const result = generateWorkLogsFromGitHubCommits(commits, [], mockProjects, mockDevMapping);
    expect(result.createdCount).toBe(1);
    expect(result.newLogs[0].taskTicketId).toBe("CARPE-402");
    expect(result.newLogs[0].client).toBe("Carpe Diem");
    expect(result.newLogs[0].projectName).toBe("admin-portal");
  });
});
