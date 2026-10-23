import { z } from "zod";

export const WorkLogSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  developerId: z.string().min(1),
  developerName: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  category: z.string().min(1),
  durationMinutes: z.number().int().positive("Duration must be positive integer minutes"),
  hours: z.number().nonnegative(),
  description: z.string(),
  taskTicketId: z.string().optional(),
  sourceSheetId: z.string().optional(),
  sourceTab: z.string(),
  sourceRowIndex: z.number().int().nonnegative(),
});

export const GitHubCommitSchema = z.object({
  sha: z.string().min(1),
  shortSha: z.string().min(1),
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
  repoFullName: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  message: z.string(),
  authorName: z.string(),
  authorEmail: z.string().optional(),
  authorLogin: z.string().optional(),
  authorAvatarUrl: z.string().optional(),
  committerName: z.string().optional(),
  commitDateUtc: z.string(),
  commitDateLocal: z.string(),
  commitUrl: z.string(),
  branch: z.string().optional(),
  branches: z.array(z.string()).optional(),
  fetchedAt: z.string(),
});

export const AnalyticsSnapshotSchema = z.object({
  schemaVersion: z.string(),
  generatedAtUtc: z.string(),
  displayTimezone: z.string(),
  sourceStatus: z.enum(["connected", "unconfigured", "error"]),
  lastSuccessfulSyncAtUtc: z.string().optional(),
  summary: z.object({
    totalHours: z.number(),
    totalMinutes: z.number(),
    projectCount: z.number(),
    developerCount: z.number(),
    workLogCount: z.number(),
    githubCommitCount: z.number(),
  }),
  projects: z.array(z.any()),
  developers: z.array(z.any()),
  categories: z.array(z.any()),
  workLogs: z.array(WorkLogSchema),
  githubCommits: z.array(GitHubCommitSchema),
  githubRepositories: z.array(z.any()),
  warnings: z.array(z.string()),
});

export const GitHubRepoConfigSchema = z.object({
  owner: z.string().min(1, "GitHub owner/org is required"),
  repo: z.string().min(1, "Repository name is required"),
  defaultBranch: z.string().default("main").optional(),
});

export const ProjectConfigSchema = z.object({
  id: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "Project name is required"),
  code: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  githubRepos: z.array(GitHubRepoConfigSchema).optional(),
});

export const IntegrationSettingsSchema = z.object({
  googleSheets: z.object({
    spreadsheetId: z.string().default(""),
    tabs: z.array(
      z.object({
        tabName: z.string().min(1),
        developerName: z.string().min(1),
        developerId: z.string().min(1),
      })
    ).default([]),
    columnMapping: z.object({
      date: z.string().default("Date"),
      developer: z.string().optional(),
      project: z.string().default("Project"),
      category: z.string().default("Category"),
      duration: z.string().default("Hours"),
      description: z.string().default("Description"),
      taskTicketId: z.string().optional(),
      logId: z.string().optional(),
    }),
    customSpreadsheets: z.array(
      z.object({
        spreadsheetId: z.string().min(1),
        developerName: z.string().min(1),
        developerId: z.string().min(1),
        tabName: z.string().optional(),
      })
    ).optional(),
  }),
  projects: z.array(ProjectConfigSchema),
  developerGithubMapping: z.record(z.array(z.string())).default({}),
});
