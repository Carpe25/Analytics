import { resolveProjectClient, DEFAULT_INTEGRATION_SETTINGS } from "@/lib/config/defaults";
import { ProjectConfig, ProjectSummary } from "@/types";

export const STANDARD_CATEGORIES = [
  "New Feature",
  "Bugs/Fix",
  "R&D",
  "Testing",
  "Preparation",
  "Improvement",
  "Meeting",
  "Development",
  "Review",
  "Docs/Proposal",
  "Deployment",
  "Frontend",
  "Backend",
  "Bug Fix",
  "Code Review",
  "DevOps",
  "Design",
];

export interface ResolvedProject {
  id: string;
  name: string;
  client: string;
  code?: string;
}

export function normalizeClientName(rawClient?: unknown): string | undefined {
  if (typeof rawClient !== "string" || !rawClient.trim()) return undefined;
  const lower = rawClient.trim().toLowerCase();

  if (/\b(?:universal|diamonds?|univ(?:\s*diam)?|ud)\b/i.test(lower)) return "Universal Diamonds";
  if (/\b(?:carpe(?:\s*di[ae]m)?|carpedi[ae]m|cd|diem)\b/i.test(lower)) return "Carpe Diem";
  if (/\b(?:effision|plm)\b/i.test(lower)) return "Effision";
  if (/\b(?:level\s*up)\b/i.test(lower)) return "Level Up";
  if (/\b(?:lumen)\b/i.test(lower)) return "Lumen";
  if (/\b(?:internal|operation|ops)\b/i.test(lower)) return "Internal / Operations";

  return rawClient.trim();
}

function detectClientInText(text: string): { client?: string; cleanedText: string } {
  const lower = text.toLowerCase();
  let client: string | undefined;
  let cleaned = text;

  if (/\b(carpe\s*(?:diem|diam)|carpedi[ae]m)\b/i.test(lower)) {
    client = "Carpe Diem";
    cleaned = cleaned.replace(/\b(carpe\s*(?:diem|diam)|carpedi[ae]m)\b/gi, "").trim();
  } else if (/\b(universal\s*diamonds?|univ\s*diam|univ\s*diamonds?|\bud\b)\b/i.test(lower)) {
    client = "Universal Diamonds";
    cleaned = cleaned.replace(/\b(universal\s*diamonds?|univ\s*diam|univ\s*diamonds?|\bud\b)\b/gi, "").trim();
  } else if (/\beffision\b/i.test(lower)) {
    client = "Effision";
    cleaned = cleaned.replace(/\beffision\b/gi, "").trim();
  } else if (/\blevel\s*up\b/i.test(lower)) {
    client = "Level Up";
    cleaned = cleaned.replace(/\blevel\s*up\b/gi, "").trim();
  } else if (/\blumen\b/i.test(lower)) {
    client = "Lumen";
    cleaned = cleaned.replace(/\blumen\b/gi, "").trim();
  }

  // Clean trailing or leading hyphens/slashes left over
  cleaned = cleaned.replace(/^[\s\-_/:]+|[\s\-_/:]+$/g, "").trim();

  return { client, cleanedText: cleaned || text };
}

export function resolveProject(
  rawProject: string,
  rawClientOrConfig?: string | ProjectConfig[],
  configuredProjects: ProjectConfig[] = [],
  snapshotProjects: ProjectSummary[] = []
): ResolvedProject {
  const queryRaw = (rawProject || "").trim();
  if (!queryRaw) {
    return {
      id: "proj-unassigned",
      name: "Unassigned",
      client: "Internal / Operations",
    };
  }

  let rawClient: string | undefined;
  let effectiveConfigProjects = configuredProjects;
  let effectiveSnapshotProjects = snapshotProjects;

  if (Array.isArray(rawClientOrConfig)) {
    rawClient = undefined;
    effectiveConfigProjects = rawClientOrConfig;
    effectiveSnapshotProjects = (configuredProjects as unknown as ProjectSummary[]) || [];
  } else {
    rawClient = rawClientOrConfig;
  }

  // Detect explicit or embedded client
  const textDetection = detectClientInText(queryRaw);
  const targetClient = normalizeClientName(rawClient) || textDetection.client;
  const projectQuery = (rawClient ? queryRaw : textDetection.cleanedText).trim();

  const queryLower = projectQuery.toLowerCase();
  const queryClean = queryLower.replace(/[^a-z0-9]/g, "");

  const projectMap = new Map<
    string,
    { id: string; name: string; client: string; code?: string; aliases?: string[] }
  >();

  for (const p of effectiveConfigProjects) {
    const resolvedClient = p.client || resolveProjectClient(p.name, p.client);
    projectMap.set(p.id, { id: p.id, name: p.name, client: resolvedClient, code: p.code, aliases: p.aliases });
  }

  for (const sp of effectiveSnapshotProjects) {
    const resolvedClient = sp.client || resolveProjectClient(sp.name, sp.client);
    const existing = projectMap.get(sp.id);
    if (!existing) {
      projectMap.set(sp.id, { id: sp.id, name: sp.name, client: resolvedClient, code: sp.code, aliases: [] });
    } else if (!existing.client && resolvedClient) {
      existing.client = resolvedClient;
    }
  }

  let candidates = Array.from(projectMap.values());

  // If a specific client is targeted, prioritize or filter to that client
  if (targetClient) {
    const clientCandidates = candidates.filter(
      (c) =>
        normalizeClientName(c.client)?.toLowerCase() === normalizeClientName(targetClient)?.toLowerCase() ||
        c.client.toLowerCase() === targetClient.toLowerCase()
    );
    if (clientCandidates.length > 0) {
      candidates = clientCandidates;
    }
  }

  // Check common typos for Analytics
  if (/an[al]?[ly]tics/i.test(queryLower)) {
    const analyticsCand = candidates.find((c) => /analytics/i.test(c.id) || /analytics/i.test(c.name));
    if (analyticsCand) {
      return {
        id: analyticsCand.id,
        name: analyticsCand.name,
        client: analyticsCand.client || targetClient || "Carpe Diem",
        code: analyticsCand.code,
      };
    }
  }

  // 1. Exact match on id, name, code, or aliases
  for (const cand of candidates) {
    if (
      cand.id.toLowerCase() === queryLower ||
      cand.name.toLowerCase() === queryLower ||
      (cand.code && cand.code.toLowerCase() === queryLower) ||
      (cand.aliases && cand.aliases.some((a) => a.toLowerCase() === queryLower))
    ) {
      return {
        id: cand.id,
        name: cand.name,
        client: targetClient || cand.client,
        code: cand.code,
      };
    }
  }

  // 2. Alphanumeric clean match
  for (const cand of candidates) {
    const candNameClean = cand.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const candIdClean = cand.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (candNameClean === queryClean || candIdClean === queryClean) {
      return {
        id: cand.id,
        name: cand.name,
        client: targetClient || cand.client,
        code: cand.code,
      };
    }
  }

  // 3. Substring match
  for (const cand of candidates) {
    const nameLower = cand.name.toLowerCase();
    if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
      return {
        id: cand.id,
        name: cand.name,
        client: targetClient || cand.client,
        code: cand.code,
      };
    }
    if (cand.aliases) {
      for (const a of cand.aliases) {
        const aLower = a.toLowerCase();
        if (aLower.includes(queryLower) || queryLower.includes(aLower)) {
          return {
            id: cand.id,
            name: cand.name,
            client: targetClient || cand.client,
            code: cand.code,
          };
        }
      }
    }
  }

  // 4. Token overlap matching
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 2);
  if (queryTokens.length > 0) {
    let bestMatch: (typeof candidates)[0] | null = null;
    let maxMatches = 0;

    for (const cand of candidates) {
      const targetStr = `${cand.name} ${cand.code || ""} ${(cand.aliases || []).join(" ")}`.toLowerCase();
      let matchCount = 0;
      for (const token of queryTokens) {
        if (targetStr.includes(token)) {
          matchCount++;
        }
      }
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        bestMatch = cand;
      }
    }

    if (bestMatch && maxMatches >= Math.min(2, queryTokens.length)) {
      return {
        id: bestMatch.id,
        name: bestMatch.name,
        client: targetClient || bestMatch.client,
        code: bestMatch.code,
      };
    }
  }

  // 5. Fallback slug with client scoping if client specified
  const finalClient = targetClient || resolveProjectClient(projectQuery);
  const projectSlug = queryLower.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fallbackId = targetClient
    ? `proj-${targetClient.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${projectSlug}`
    : `proj-${projectSlug}`;

  return {
    id: fallbackId,
    name: projectQuery,
    client: finalClient,
  };
}

export function resolveCategory(categoryInput: string, existingCategories: { name: string }[] = []): string {
  const trimmed = (categoryInput || "").trim();
  if (!trimmed) return "Development";

  const lower = trimmed.toLowerCase();
  const allKnown = Array.from(new Set([...STANDARD_CATEGORIES, ...existingCategories.map((c) => c.name)]));

  // 1. Exact match
  const exact = allKnown.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Common specific synonyms / keyword matching
  if (/\b(pr|pull request|code review|review)\b/i.test(lower)) return "Review";
  if (/\b(bug|bugs|fix|defect|issue|error)\b/i.test(lower)) return "Bugs/Fix";
  if (/\b(meet|meeting|call|sync|standup|discussion)\b/i.test(lower)) return "Meeting";
  if (/\b(test|testing|qa|spec|unit)\b/i.test(lower)) return "Testing";
  if (/\b(doc|docs|documentation|proposal|rfc|guide)\b/i.test(lower)) return "Docs/Proposal";
  if (/\b(deploy|deployment|ci|cd|release|infra)\b/i.test(lower)) return "Deployment";
  if (/\b(feature|enhancement)\b/i.test(lower)) return "New Feature";
  if (/\b(dev|development|implement|code)\b/i.test(lower)) return "Development";

  // 3. Substring match for longer queries
  if (lower.length >= 4) {
    const sub = allKnown.find((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
    if (sub) return sub;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
