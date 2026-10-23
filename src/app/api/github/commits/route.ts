import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const repo = searchParams.get("repo");
  const author = searchParams.get("author");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const storage = getArtifactStorage();
  const snapshot = await storage.readLatestAnalytics();
  if (!snapshot) {
    return NextResponse.json({ commits: [] });
  }

  let commits = [...snapshot.githubCommits];
  if (projectId && projectId !== "all") {
    commits = commits.filter((c) => c.projectId === projectId);
  }
  if (repo && repo !== "all") {
    commits = commits.filter((c) => c.repoFullName === repo);
  }
  if (author) {
    const a = author.toLowerCase();
    commits = commits.filter(
      (c) =>
        c.authorName.toLowerCase().includes(a) ||
        (c.authorLogin && c.authorLogin.toLowerCase().includes(a))
    );
  }
  if (startDate) {
    commits = commits.filter((c) => c.commitDateUtc.slice(0, 10) >= startDate);
  }
  if (endDate) {
    commits = commits.filter((c) => c.commitDateUtc.slice(0, 10) <= endDate);
  }

  return NextResponse.json({
    commits,
    totalCount: commits.length,
    repositories: snapshot.githubRepositories,
  });
}
