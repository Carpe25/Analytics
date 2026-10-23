"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderGit2,
  GitCommit,
  Users,
  Tag,
  ArrowLeft,
  Clock,
  Plus,
  GitBranch,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommitTable } from "@/components/github/commit-table";
import { ConnectRepoDialog } from "@/components/github/connect-repo-dialog";
import { WorkLog, GitHubCommit, ProjectSummary } from "@/types";

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [data, setData] = useState<{
    project: ProjectSummary;
    config?: any;
    workLogs: WorkLog[];
    commits: GitHubCommit[];
    developerBreakdown: { id: string; name: string; hours: number; percentage: number; count: number }[];
    categoryBreakdown: { category: string; hours: number; percentage: number; count: number }[];
    devCategoryMatrix: Record<string, Record<string, number>>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadProjectDetails = useCallback(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.error) {
          setData(resData);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadProjectDetails();
  }, [loadProjectDetails]);

  const handleDisconnectRepo = async (owner: string, repo: string) => {
    if (!confirm(`Are you sure you want to disconnect ${owner}/${repo} from this project?`)) {
      return;
    }

    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!json?.settings) return;

      const updatedProjects = json.settings.projects.map((p: any) => {
        if (p.id === projectId) {
          return {
            ...p,
            githubRepos: (p.githubRepos || []).filter(
              (r: any) => !(r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase())
            ),
          };
        }
        return p;
      });

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...json.settings, projects: updatedProjects }),
      });

      loadProjectDetails();
    } catch (err) {
      alert("Failed to disconnect repository");
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 p-12 text-center text-xs text-[#17212B]/60">
        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-50" />
        Loading project details...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 p-12 text-center">
        <h3 className="text-base font-semibold text-[#17212B]">Project Not Found</h3>
        <p className="text-xs text-[#17212B]/70 mt-1">This project does not exist in the current snapshot.</p>
        <Link href="/projects" className="inline-block mt-4">
          <Button size="sm">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const { project, workLogs, commits, developerBreakdown, categoryBreakdown, devCategoryMatrix } = data;
  const categoriesList = categoryBreakdown.map((c) => c.category);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={project.name}
        description={`Project Code: ${project.code || "N/A"} • Total: ${project.totalHours.toFixed(1)} hours logged`}
        onSyncComplete={loadProjectDetails}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/projects">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>All Projects</span>
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Connect GitHub</span>
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Project KPI Stats: Flat, unboxed layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-3 border-b border-[#17212B]/15">
          <div>
            <p className="text-[10px] font-semibold text-[#17212B]/60 uppercase tracking-wider">Total Hours</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{project.totalHours.toFixed(1)}h</h4>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#17212B]/60 uppercase tracking-wider">Developers</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{project.developerCount}</h4>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#17212B]/60 uppercase tracking-wider">Work Logs</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{project.logCount}</h4>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#17212B]/60 uppercase tracking-wider">GitHub Commits</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{commits.length}</h4>
          </div>
        </div>

        {/* 7 Required Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-10 p-1 border-b border-[#17212B]/15">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="work-logs">Work Logs ({workLogs.length})</TabsTrigger>
            <TabsTrigger value="developers">Developer Breakdown</TabsTrigger>
            <TabsTrigger value="categories">Category Breakdown</TabsTrigger>
            <TabsTrigger value="matrix">Developer × Category Matrix</TabsTrigger>
            <TabsTrigger value="github">GitHub Commits ({commits.length})</TabsTrigger>
            <TabsTrigger value="sync-source">Sync / Source Details</TabsTrigger>
          </TabsList>

          {/* TAB 1: SUMMARY */}
          <TabsContent value="summary" className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Developers */}
              <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
                <CardHeader>
                  <CardTitle className="text-sm">Top Developer Contributions</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Developer</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {developerBreakdown.slice(0, 5).map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs font-medium">{d.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">{d.hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right font-mono text-xs">{d.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Categories */}
              <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
                <CardHeader>
                  <CardTitle className="text-sm">Category Allocation</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryBreakdown.map((c) => (
                        <TableRow key={c.category}>
                          <TableCell className="text-xs font-medium">{c.category}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">{c.hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right font-mono text-xs">{c.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: WORK LOGS */}
          <TabsContent value="work-logs" className="pt-4">
            <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead className="w-36">Developer</TableHead>
                      <TableHead className="w-28">Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Ticket ID</TableHead>
                      <TableHead className="w-24 text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{log.date}</TableCell>
                        <TableCell className="text-xs font-medium">{log.developerName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {log.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#17212B]/90">{log.description}</TableCell>
                        <TableCell className="font-mono text-[11px] text-[#17212B]/75">{log.taskTicketId || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold whitespace-nowrap">
                          {log.hours.toFixed(1)}h
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: DEVELOPER BREAKDOWN */}
          <TabsContent value="developers" className="pt-4">
            <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Developer</TableHead>
                      <TableHead className="text-right">Logged Hours</TableHead>
                      <TableHead className="text-right">Contribution %</TableHead>
                      <TableHead className="text-right">Log Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {developerBreakdown.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-semibold">{d.name}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">{d.hours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right font-mono text-xs">{d.percentage}%</TableCell>
                        <TableCell className="text-right font-mono text-xs">{d.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: CATEGORY BREAKDOWN */}
          <TabsContent value="categories" className="pt-4">
            <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Hours Logged</TableHead>
                      <TableHead className="text-right">Share of Total</TableHead>
                      <TableHead className="text-right">Log Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryBreakdown.map((c) => (
                      <TableRow key={c.category}>
                        <TableCell className="text-xs font-semibold">{c.category}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">{c.hours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.percentage}%</TableCell>
                        <TableCell className="text-right font-mono text-xs">{c.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: DEVELOPER X CATEGORY MATRIX */}
          <TabsContent value="matrix" className="pt-4">
            <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Developer</TableHead>
                      {categoriesList.map((cat) => (
                        <TableHead key={cat} className="text-right whitespace-nowrap">
                          {cat}
                        </TableHead>
                      ))}
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(devCategoryMatrix).map(([devName, cats]) => {
                      const totalMin = Object.values(cats).reduce((s, v) => s + v, 0);
                      return (
                        <TableRow key={devName}>
                          <TableCell className="text-xs font-semibold">{devName}</TableCell>
                          {categoriesList.map((cat) => {
                            const minutes = cats[cat] || 0;
                            return (
                              <TableCell key={cat} className="text-right font-mono text-xs">
                                {minutes > 0 ? `${(minutes / 60).toFixed(1)}h` : "—"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-mono text-xs font-bold">
                            {(totalMin / 60).toFixed(1)}h
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: GITHUB COMMITS */}
          <TabsContent value="github" className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#17212B]/70">
                Commits synced from connected GitHub repositories for project <strong>{project.name}</strong>.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Repository</span>
              </Button>
            </div>
            <CommitTable commits={commits} emptyMessage="No commits synced for this project yet." />
          </TabsContent>

          {/* TAB 7: SYNC & SOURCE DETAILS */}
          <TabsContent value="sync-source" className="pt-4 space-y-6">
            {/* Connected Repositories Card */}
            <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm">Connected GitHub Repositories</CardTitle>
                  <p className="text-xs text-[#17212B]/60 mt-0.5">
                    Repositories whose commit history is linked to this project
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Connect Repository</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {(!data.config?.githubRepos || data.config.githubRepos.length === 0) ? (
                  <div className="p-6 text-center text-xs text-[#17212B]/60">
                    <GitBranch className="h-6 w-6 mx-auto mb-2 opacity-40" />
                    <p>No GitHub repositories currently connected to this project.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Repository</TableHead>
                        <TableHead>Default Branch</TableHead>
                        <TableHead className="w-24 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.config.githubRepos.map((repo: any) => (
                        <TableRow key={`${repo.owner}/${repo.repo}`}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {repo.owner}/{repo.repo}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#17212B]/75">
                            {repo.defaultBranch || "main"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnectRepo(repo.owner, repo.repo)}
                              className="h-7 px-2 text-[#17212B] hover:bg-[#17212B]/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Source Sheet Info */}
            <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
              <CardHeader>
                <CardTitle className="text-sm">Google Sheets Source Identity</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-[#17212B]/80 font-mono">
                <div>Canonical Project ID: <strong>{project.id}</strong></div>
                <div>Project Code: <strong>{project.code || "None"}</strong></div>
                <div>Recognized Aliases: <strong>{(data.config?.aliases || []).join(", ") || "None"}</strong></div>
                <div>Total Work Log Rows: <strong>{workLogs.length}</strong></div>
                <div>Last Recorded Work Date: <strong>{project.latestLogDate || "None"}</strong></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConnectRepoDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        defaultProjectId={projectId}
        onSuccess={loadProjectDetails}
      />
    </div>
  );
}
