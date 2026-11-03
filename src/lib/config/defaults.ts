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
    "dev-jay": ["jay", "jaytcdj-dev", "jaydev", "jay-eng", "jay patel", "jaypatel"],
    "dev-kaif": ["kaif", "khankaif", "kaif khan", "kaif-khan", "khan kaif"],
    "dev-mahesh": ["mahesh", "maheshthakur9152", "mahesh thakur", "mahesh-thakur", "maheshthakur"],
    "dev-amol": ["amol", "amol yadav", "amolyadav", "amol-yadav"],
    "dev-jemish": ["jemish", "jemish sakariya", "jemish-sakariya", "jemish-vision", "jemishvision"],
    "dev-ashfaq-hussain": ["ashfaq", "ashfaq hussain", "ashfaq-hussain"],
    "dev-paulkumar-nadar": ["paulkumar", "paulkumar nadar", "paulkumar-nadar"],
    "dev-zaid-khan": ["zaid", "zaid khan", "zaid-khan"],
    "dev-vikas-rathod": ["vikas", "vikas rathod", "vikas-rathod"],
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
