import { NextRequest, NextResponse } from "next/server";
import { getArtifactStorage } from "@/lib/storage/provider";
import { getRequestAuth, isManager } from "@/lib/auth/guard";
import { resolveCanonicalDeveloper } from "@/lib/analytics/canonical-developer";

export async function GET(req: NextRequest) {
  const auth = await getRequestAuth(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  const settings = await storage.readIntegrationSettings();

  // Enforce developer account isolation
  if (!isManager(auth) && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings?.developerGithubMapping);

    if (author && !author.toLowerCase().includes(authCanon.id.replace(/^dev-/, "")) && !authCanon.name.toLowerCase().includes(author.toLowerCase())) {
      const requestedCanon = resolveCanonicalDeveloper(author, settings?.developerGithubMapping);
      if (requestedCanon.id !== authCanon.id && requestedCanon.id !== "dev-unknown") {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to view another developer's commits." },
          { status: 403 }
        );
      }
    }
  }

  let commits = [...snapshot.githubCommits];

  if (!isManager(auth) && auth.user) {
    const authDevIdentifier = auth.user.developerId || auth.user.username;
    const authCanon = resolveCanonicalDeveloper(authDevIdentifier, settings?.developerGithubMapping);
    commits = commits.filter(
      (c) => resolveCanonicalDeveloper(c.authorLogin || c.authorName, settings?.developerGithubMapping).id === authCanon.id
    );
  }
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
