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
      client: "Client",
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
      client: "Internal / Operations",
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
      client: "Internal / Operations",
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
      client: "Internal / Operations",
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

/**
 * Resolves the client name for a project.
 * Uses explicitly configured client if present, otherwise maps based on known project names/codes.
 */
export function resolveProjectClient(projectNameOrId: string, configuredClient?: string): string {
  if (configuredClient && configuredClient.trim()) {
    return configuredClient.trim();
  }
  const str = (projectNameOrId || "").toLowerCase();
  if (/cad[- _]?portal|medusa|shopify/i.test(str)) {
    return "Carpe Diem";
  }
  if (/effision|plm/i.test(str)) {
    return "Effision";
  }
  if (/custom[- _]?portal|jewelry|ud/i.test(str)) {
    return "Universal Diamonds";
  }
  if (/level[- _]?up/i.test(str)) {
    return "Level Up";
  }
  if (/lumen/i.test(str)) {
    return "Lumen";
  }
  if (/hardware|recruiting|others|unassigned/i.test(str)) {
    return "Internal / Operations";
  }
  return "Internal / Operations";
}
