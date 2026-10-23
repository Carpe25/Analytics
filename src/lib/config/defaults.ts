import { IntegrationSettings } from "@/types";

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  googleSheets: {
    spreadsheetId: "1W2ost-DV0kjDOahoAkwEbX-c5-BhPWzuAQbxxHiaXkk",
    tabs: [
      { tabName: "Jay_Log", developerName: "Jay", developerId: "dev-jay" },
      { tabName: "Kaif_log", developerName: "Kaif", developerId: "dev-kaif" },
      { tabName: "Mahesh_log", developerName: "Mahesh", developerId: "dev-mahesh" },
      { tabName: "Amol_Log", developerName: "Amol", developerId: "dev-amol" },
    ],
    columnMapping: {
      date: "Date",
      project: "Project",
      category: "Task Category",
      duration: "Time Hours",
      description: "Description",
      taskTicketId: "Ticket ID",
      logId: "Log ID",
    },
    customSpreadsheets: [],
  },
  projects: [
    {
      id: "proj-core-platform",
      name: "Core Platform",
      code: "CORE",
      aliases: ["Core", "Platform", "Backend Core"],
      githubRepos: [
        {
          owner: "company",
          repo: "core-platform",
          defaultBranch: "main",
        },
      ],
    },
    {
      id: "proj-analytics-ui",
      name: "Analytics UI",
      code: "AUI",
      aliases: ["Analytics", "Dashboard", "Frontend"],
      githubRepos: [
        {
          owner: "company",
          repo: "analytics-ui",
          defaultBranch: "main",
        },
      ],
    },
    {
      id: "proj-mobile-app",
      name: "Mobile App",
      code: "MOB",
      aliases: ["Mobile", "iOS", "Android"],
      githubRepos: [],
    },
  ],
  developerGithubMapping: {
    "dev-jay": ["jaydev", "jay-eng"],
    "dev-alex": ["alex-codes"],
    "dev-sam": ["sam-builder"],
  },
};
