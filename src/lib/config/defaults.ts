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
 * Resolves canonical client name consistently across sheets, settings, and MCP.
 */
export function canonicalClient(rawClient?: unknown): string {
  if (typeof rawClient !== "string" || !rawClient.trim()) return "Unassigned";
  const lower = rawClient.trim().toLowerCase();

  if (lower === "oromond" || lower === "oramond") return "Oramond";
  if (/\b(?:univ(?:\s*diam)?|universal(?:\s*diamonds?)?|ud)\b/i.test(lower)) return "Univ Diam";
  if (/\b(?:carpe(?:\s*di[ae]m)?|carpedi[ae]m|cd)\b/i.test(lower)) return "Carpe Diem";
  if (/\b(?:effision|plm)\b/i.test(lower)) return "Effision";
  if (/\b(?:level\s*up)\b/i.test(lower)) return "Level Up";
  if (/\b(?:lumen)\b/i.test(lower)) return "Lumen";
  if (/\b(?:cast(?:\s*and\s*|\s*&\s*)creed)\b/i.test(lower)) return "Cast and Creed";
  if (/\b(?:internal|operations?|ops)\b/i.test(lower)) return "Internal / Operations";

  return rawClient.trim();
}

/**
 * Checks if two client representations refer to the same client.
 */
export function isSameClient(clientA?: unknown, clientB?: unknown): boolean {
  if (!clientA && !clientB) return true;
  if (!clientA || !clientB) return false;
  return canonicalClient(clientA).toLowerCase() === canonicalClient(clientB).toLowerCase();
}

/**
 * Builds a deterministic, client-scoped project identifier.
 */
export function buildProjectId(projectName: string, client?: string): string {
  const pSlug = (projectName || "unassigned").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const canon = client ? canonicalClient(client) : "";
  const cSlug = canon && canon !== "Unassigned" ? canon.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  if (!cSlug || pSlug.startsWith(cSlug)) {
    return `proj-${pSlug}`;
  }
  return `proj-${cSlug}-${pSlug}`;
}

/**
 * Resolves the client name for a project.
 * Uses explicitly configured client if present, otherwise maps based on known project names/codes.
 */
export function resolveProjectClient(projectNameOrId: string, configuredClient?: string): string {
  if (configuredClient && configuredClient.trim()) {
    return canonicalClient(configuredClient);
  }
  const str = (projectNameOrId || "").toLowerCase();
  if (/cad[- _]?portal|medusa|shopify/i.test(str)) {
    return "Carpe Diem";
  }
  if (/effision|plm/i.test(str)) {
    return "Effision";
  }
  if (/jewelry|ud/i.test(str)) {
    return "Univ Diam";
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
