import { WorkLog, ProjectConfig, ProjectSummary, Client } from "@/types";
import { canonicalClient, isSameClient } from "@/lib/config/defaults";
import { IArtifactStorage } from "@/lib/storage/interface";

export interface BreakdownProject {
  id: string;
  name: string;
  code?: string;
  client: string;
  totalMinutes: number;
  totalHours: number;
  developerCount: number;
  logCount: number;
  connectedRepos: string[];
  categories: string[];
  latestLogDate?: string;
}

export interface ClientGroup {
  clientName: string;
  totalMinutes: number;
  totalHours: number;
  developerCount: number;
  logCount: number;
  projects: BreakdownProject[];
}

export function computeClientBreakdown(
  logs: WorkLog[],
  projectsConfig: ProjectConfig[],
  snapshotProjects: ProjectSummary[] = []
): ClientGroup[] {
  const clientGroups: Record<
    string,
    {
      clientName: string;
      totalMinutes: number;
      developerIds: Set<string>;
      logCount: number;
      projectsMap: Record<
        string,
        {
          id: string;
          name: string;
          code?: string;
          client: string;
          totalMinutes: number;
          developerIds: Set<string>;
          logCount: number;
          connectedRepos: string[];
          categoriesMap: Record<string, number>;
          latestLogDate?: string;
        }
      >;
    }
  > = {};

  for (const l of logs) {
    let client = canonicalClient(l.client);

    if (!clientGroups[client]) {
      clientGroups[client] = {
        clientName: client,
        totalMinutes: 0,
        developerIds: new Set(),
        logCount: 0,
        projectsMap: {},
      };
    }
    const grp = clientGroups[client];
    grp.totalMinutes += l.durationMinutes;
    grp.developerIds.add(l.developerId);
    grp.logCount += 1;

    if (!grp.projectsMap[l.projectId]) {
      const cfg =
        projectsConfig.find(
          (p) =>
            (p.id === l.projectId || (p.aliases && p.aliases.includes(l.projectId))) &&
            isSameClient(p.client, client)
        ) ||
        projectsConfig.find(
          (p) =>
            p.name.toLowerCase() === l.projectName.toLowerCase() &&
            isSameClient(p.client, client)
        ) ||
        projectsConfig.find(
          (p) =>
            (p.id === l.projectId || (p.aliases && p.aliases.includes(l.projectId))) &&
            !p.client
        );

      const snapProj =
        snapshotProjects.find(
          (p) => (p.id === l.projectId || p.id === cfg?.id) && isSameClient(p.client, client)
        ) ||
        snapshotProjects.find((p) => p.id === l.projectId && isSameClient(p.client, client));

      const connectedRepos = (cfg?.githubRepos || []).map((r) => `${r.owner}/${r.repo}`);

      grp.projectsMap[l.projectId] = {
        id: l.projectId,
        name: l.projectName,
        code: cfg?.code || snapProj?.code,
        client,
        totalMinutes: 0,
        developerIds: new Set(),
        logCount: 0,
        connectedRepos:
          connectedRepos.length > 0
            ? connectedRepos
            : snapProj && isSameClient(snapProj.client, client)
            ? snapProj.connectedRepos || []
            : [],
        categoriesMap: {},
        latestLogDate: l.date,
      };
    }

    const pEntry = grp.projectsMap[l.projectId];
    pEntry.totalMinutes += l.durationMinutes;
    pEntry.developerIds.add(l.developerId);
    pEntry.logCount += 1;
    if (l.category) {
      pEntry.categoriesMap[l.category] = (pEntry.categoriesMap[l.category] || 0) + l.durationMinutes;
    }
    if (!pEntry.latestLogDate || l.date > pEntry.latestLogDate) {
      pEntry.latestLogDate = l.date;
    }
  }

  // Also include configured projects for each client so they are discoverable even before first sync
  for (const p of projectsConfig) {
    const client = canonicalClient(p.client);
    if (!clientGroups[client]) {
      clientGroups[client] = {
        clientName: client,
        totalMinutes: 0,
        developerIds: new Set(),
        logCount: 0,
        projectsMap: {},
      };
    }
    const grp = clientGroups[client];
    if (!grp.projectsMap[p.id]) {
      const snapProj = snapshotProjects.find((sp) => sp.id === p.id);
      const connectedRepos = (p.githubRepos || []).map((r) => `${r.owner}/${r.repo}`);
      grp.projectsMap[p.id] = {
        id: p.id,
        name: p.name,
        code: p.code || snapProj?.code,
        client,
        totalMinutes: 0,
        developerIds: new Set(),
        logCount: 0,
        connectedRepos,
        categoriesMap: {},
        latestLogDate: snapProj?.latestLogDate,
      };
    }
  }

  return Object.values(clientGroups)
    .map((c) => {
      const projects = Object.values(c.projectsMap)
        .map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          client: p.client,
          totalMinutes: p.totalMinutes,
          totalHours: Number((p.totalMinutes / 60).toFixed(1)),
          developerCount: p.developerIds.size,
          logCount: p.logCount,
          connectedRepos: p.connectedRepos,
          categories: Object.keys(p.categoriesMap).sort(
            (a, b) => p.categoriesMap[b] - p.categoriesMap[a]
          ),
          latestLogDate: p.latestLogDate,
        }))
        .sort((a, b) => b.totalHours - a.totalHours);

      return {
        clientName: c.clientName,
        totalMinutes: c.totalMinutes,
        totalHours: Number((c.totalMinutes / 60).toFixed(1)),
        developerCount: c.developerIds.size,
        logCount: c.logCount,
        projects,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);
}

export interface PublicDirectoryProject {
  id: string;
  name: string;
  code?: string;
  displayName: string;
  client: string;
}

/**
 * Loads the complete unified list of clients and projects for the public ticket directory,
 * perfectly synchronized with what the Projects page displays.
 */
export async function getUnifiedClientDirectory(storage: IArtifactStorage): Promise<{
  clients: string[];
  clientEntities: Client[];
  projects: PublicDirectoryProject[];
}> {
  const [snapshot, settings, clientEntities] = await Promise.all([
    storage.readLatestAnalytics(),
    storage.readIntegrationSettings(),
    storage.readClients(),
  ]);

  const projectsConfig = settings?.projects || [];
  const workLogs = snapshot?.workLogs || [];
  const snapshotProjects = snapshot?.projects || [];

  const breakdown = computeClientBreakdown(workLogs, projectsConfig, snapshotProjects);

  const clientNamesSet = new Set<string>();

  // 1. Add all clients from the active breakdown
  for (const group of breakdown) {
    if (group.clientName && group.clientName !== "Unassigned") {
      clientNamesSet.add(group.clientName);
    }
  }

  // 2. Add all registered clients from database
  for (const ce of clientEntities) {
    if (ce.name) {
      clientNamesSet.add(canonicalClient(ce.name));
    }
  }

  // 3. Add any clients configured in settings
  for (const p of projectsConfig) {
    if (p.client) {
      clientNamesSet.add(canonicalClient(p.client));
    }
  }

  const clients = Array.from(clientNamesSet).sort((a, b) => a.localeCompare(b));

  // Build unified project list
  const unifiedProjects: PublicDirectoryProject[] = [];
  const seenProjectKey = new Set<string>();

  for (const group of breakdown) {
    const client = group.clientName;

    // Filter and deduplicate projects under this client
    for (const p of group.projects) {
      // Build a clean display name
      const displayName = p.code ? `${p.name} [${p.code}]` : p.name;
      const dedupeKey = `${client.toLowerCase()}:::${displayName.toLowerCase()}`;

      if (!seenProjectKey.has(dedupeKey)) {
        seenProjectKey.add(dedupeKey);
        unifiedProjects.push({
          id: p.id,
          name: p.name,
          code: p.code,
          displayName,
          client,
        });
      }
    }
  }

  // Also include any standalone configured projects that had no logs yet
  for (const p of projectsConfig) {
    const client = canonicalClient(p.client);
    const displayName = p.code ? `${p.name} [${p.code}]` : p.name;
    const dedupeKey = `${client.toLowerCase()}:::${displayName.toLowerCase()}`;

    if (!seenProjectKey.has(dedupeKey)) {
      seenProjectKey.add(dedupeKey);
      unifiedProjects.push({
        id: p.id,
        name: p.name,
        code: p.code,
        displayName,
        client,
      });
    }
  }

  // Sort projects alphabetically by display name
  unifiedProjects.sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    clients,
    clientEntities,
    projects: unifiedProjects,
  };
}
