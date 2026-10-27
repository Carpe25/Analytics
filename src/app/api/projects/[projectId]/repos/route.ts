import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { ProjectService } from "@/lib/projects/project-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const storage = getArtifactStorage();
    const service = new ProjectService(storage);
    const all = await service.getAllProjects();
    const project = all.find((p) => p.id === projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      projectId,
      githubRepos: project.githubRepos,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch repositories" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const body = await req.json();
    const { owner, repo, defaultBranch } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "GitHub owner and repository name are required" },
        { status: 400 }
      );
    }

    const storage = getArtifactStorage();
    const service = new ProjectService(storage);
    const result = await service.connectRepository(projectId, {
      owner,
      repo,
      defaultBranch: defaultBranch || "main",
    });

    return NextResponse.json({
      success: true,
      message: `Successfully connected ${owner}/${repo} to project`,
      project: result.project,
      commitsFetched: result.commitsFetched,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to connect repository" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;
    const body = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "GitHub owner and repository name are required" },
        { status: 400 }
      );
    }

    const storage = getArtifactStorage();
    const service = new ProjectService(storage);
    await service.disconnectRepository(projectId, owner, repo);

    return NextResponse.json({
      success: true,
      message: `Disconnected ${owner}/${repo}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to disconnect repository" },
      { status: 500 }
    );
  }
}
