import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { computeAnalytics } from "@/lib/analytics/aggregate";
import { DEFAULT_INTEGRATION_SETTINGS, resolveProjectClient, canonicalClient, isSameClient } from "@/lib/config/defaults";
import { WorkLog, ProjectConfig, ProjectSummary } from "@/types";
import { computeClientBreakdown } from "@/lib/projects/client-breakdown";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();
  if (!snapshot) {
    return NextResponse.json({
      projects: [],
      clientBreakdown: [],
      availableMonths: [],
      availableCategories: [],
    });
  }

  // Derive unique available months
  const monthSet = new Set<string>();
  for (const l of snapshot.workLogs) {
    if (l.date && l.date.length >= 7) {
      monthSet.add(l.date.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthSet).sort().reverse();

  const settings = (await storage.readIntegrationSettings()) || DEFAULT_INTEGRATION_SETTINGS;

  let logsToProcess = [...snapshot.workLogs];
  if (startDate) {
    logsToProcess = logsToProcess.filter((l) => l.date >= startDate);
  }
  if (endDate) {
    logsToProcess = logsToProcess.filter((l) => l.date <= endDate);
  }
  if (month && month !== "all" && !startDate && !endDate) {
    logsToProcess = logsToProcess.filter((l) => l.date.startsWith(month));
  }

  // Extract unique categories directly from work logs
  const categorySet = new Set<string>();
  logsToProcess.forEach((l) => {
    if (l.category && l.category.trim()) {
      categorySet.add(l.category.trim());
    }
  });
  const availableCategories = Array.from(categorySet).sort();

  const clientBreakdown = computeClientBreakdown(
    logsToProcess,
    settings.projects,
    snapshot.projects
  );

  const hasFilter = (month && month !== "all") || !!startDate || !!endDate;

  if (!hasFilter) {
    const projectsWithClient = snapshot.projects.map((p) => {
      const cfg = settings.projects.find((cp) => cp.id === p.id);
      return {
        ...p,
        client: p.client || resolveProjectClient(p.name, cfg?.client),
      };
    });
    return NextResponse.json({
      projects: projectsWithClient,
      clientBreakdown,
      availableMonths,
      availableCategories,
    });
  }

  const agg = computeAnalytics(
    logsToProcess,
    snapshot.githubCommits,
    settings.projects,
    settings.developerGithubMapping
  );

  return NextResponse.json({
    projects: agg.projects,
    clientBreakdown,
    availableMonths,
    availableCategories,
    month,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    const code = (body.code || "").trim().toUpperCase();
    let clientName = (body.client || "").trim();
    const clientId = (body.clientId || "").trim();
    const aliasesInput = body.aliases;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const storage = getArtifactStorage();
    const [clients, settingsData, snapshot] = await Promise.all([
      storage.readClients(),
      storage.readIntegrationSettings(),
      storage.readLatestAnalytics(),
    ]);

    const settings = settingsData || DEFAULT_INTEGRATION_SETTINGS;

    // Resolve client
    let resolvedClientId = clientId;
    if (resolvedClientId) {
      const match = clients.find((c) => c.id === resolvedClientId);
      if (match) {
        clientName = match.name;
      }
    } else if (clientName) {
      const match = clients.find((c) => c.name.toLowerCase() === clientName.toLowerCase());
      if (match) {
        resolvedClientId = match.id;
        clientName = match.name;
      } else {
        // Auto-create client so it exists in clients table
        const slug = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        resolvedClientId = `client-${slug || Date.now()}`;
        await storage.saveClient({
          id: resolvedClientId,
          name: clientName,
          code: code || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } else {
      clientName = "General";
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const projectId = `proj-${slug || Date.now()}`;

    // Check if project exists
    const existingIndex = settings.projects.findIndex(
      (p) => p.id === projectId || p.name.toLowerCase() === name.toLowerCase()
    );

    let aliases: string[] = [name];
    if (Array.isArray(aliasesInput)) {
      aliases = Array.from(new Set([name, ...aliasesInput.map((a: any) => String(a).trim()).filter(Boolean)]));
    }

    const newProject = {
      id: projectId,
      name,
      code: code || undefined,
      client: clientName,
      clientId: resolvedClientId || undefined,
      aliases,
      githubRepos: [],
    };

    if (existingIndex >= 0) {
      settings.projects[existingIndex] = {
        ...settings.projects[existingIndex],
        ...newProject,
      };
    } else {
      settings.projects.push(newProject);
    }

    await storage.writeIntegrationSettings(settings);

    // If snapshot exists, update or add to snapshot
    if (snapshot) {
      const existingSnapIndex = snapshot.projects.findIndex((p) => p.id === projectId);
      const snapProject = {
        id: projectId,
        name,
        code: code || undefined,
        client: clientName,
        totalMinutes: 0,
        totalHours: 0,
        developerCount: 0,
        logCount: 0,
        connectedRepos: [],
      };

      if (existingSnapIndex >= 0) {
        snapshot.projects[existingSnapIndex] = {
          ...snapshot.projects[existingSnapIndex],
          name,
          client: clientName,
          code: code || snapshot.projects[existingSnapIndex].code,
        };
      } else {
        snapshot.projects.push(snapProject);
      }

      await storage.publishLatestAnalytics(snapshot).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      project: newProject,
    });
  } catch (err: any) {
    console.error("Failed to create project:", err);
    return NextResponse.json({ error: err.message || "Failed to create project" }, { status: 500 });
  }
}
