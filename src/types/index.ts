export interface WorkLog {
  id: string;
  date: string; // YYYY-MM-DD
  developerId: string;
  developerName: string;
  projectId: string;
  projectName: string;
  category: string;
  durationMinutes: number;
  hours: number;
  description: string;
  taskTicketId?: string;
  sourceSheetId?: string;
  sourceTab: string;
  sourceRowIndex: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  code?: string;
  totalMinutes: number;
  totalHours: number;
  developerCount: number;
  logCount: number;
  connectedRepos: string[];
  latestCommitDate?: string;
  latestLogDate?: string;
}

export interface DeveloperSummary {
  id: string;
  name: string;
  sourceTabs: string[];
  githubUsernames: string[];
  totalMinutes: number;
  totalHours: number;
  projectCount: number;
  projects: string[];
  categoryTotals: Record<string, number>; // category -> minutes
  latestLogDate?: string;
  commitCount: number;
}

export interface CategorySummary {
  name: string;
  totalMinutes: number;
  totalHours: number;
  percentage: number;
  developerCount: number;
  projects: string[];
}

export interface GitHubCommit {
  sha: string;
  shortSha: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  projectId: string;
  projectName: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  authorLogin?: string;
  authorAvatarUrl?: string;
  committerName?: string;
  commitDateUtc: string;
  commitDateLocal: string;
  commitUrl: string;
  branch?: string;
  branches?: string[];
  fetchedAt: string;
}

export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  code?: string;
  aliases?: string[];
  githubRepos?: GitHubRepoConfig[];
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  tabs: {
    tabName: string;
    developerName: string;
    developerId: string;
  }[];
  columnMapping: {
    date: string;
    developer?: string;
    project: string;
    category: string;
    duration: string;
    description: string;
    taskTicketId?: string;
    logId?: string;
  };
  customSpreadsheets?: {
    spreadsheetId: string;
    developerName: string;
    developerId: string;
    tabName?: string;
  }[];
}

export interface IntegrationSettings {
  googleSheets: GoogleSheetsConfig;
  projects: ProjectConfig[];
  developerGithubMapping: Record<string, string[]>; // developerId -> github usernames
}

export interface SyncRun {
  runId: string;
  triggerType: "scheduled" | "manual";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  status: "success" | "partial" | "failed" | "running";
  sourcesAttempted: string[];
  rowsRead: number;
  rowsAccepted: number;
  rowsUpdated: number;
  rowsIgnored: number;
  rowsRejected: number;
  commitsFetched: number;
  errors: string[];
  warnings: string[];
  details?: Record<string, unknown>;
}

export interface AnalyticsSnapshot {
  schemaVersion: string;
  generatedAtUtc: string;
  displayTimezone: string;
  sourceStatus: "connected" | "unconfigured" | "error";
  lastSuccessfulSyncAtUtc?: string;
  summary: {
    totalHours: number;
    totalMinutes: number;
    projectCount: number;
    developerCount: number;
    workLogCount: number;
    githubCommitCount: number;
  };
  projects: ProjectSummary[];
  developers: DeveloperSummary[];
  categories: CategorySummary[];
  workLogs: WorkLog[];
  githubCommits: GitHubCommit[];
  githubRepositories: {
    repoFullName: string;
    projectId: string;
    defaultBranch: string;
    lastSyncedAt?: string;
    commitCount: number;
  }[];
  warnings: string[];
}
