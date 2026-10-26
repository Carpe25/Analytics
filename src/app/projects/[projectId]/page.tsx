"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  GitBranch,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
        description={`${project.client ? `Client: ${project.client} • ` : ""}Project Code: ${project.code || "N/A"} • Total: ${project.totalHours.toFixed(1)} hours logged`}
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

      <div className="w-full max-w-none px-8 py-6 space-y-8 font-sans">
        {/* Project KPI Stats: Flat, unboxed layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4 border-b border-[#17212B]/15">
          <div>
            <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">Total Hours</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{project.totalHours.toFixed(1)}h</h4>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">Developers</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{project.developerCount}</h4>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">Work Logs</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{project.logCount}</h4>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">GitHub Commits</p>
            <h4 className="text-3xl font-extrabold font-mono text-[#17212B] mt-1">{commits.length}</h4>
          </div>
        </div>

        {/* 7 Required Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-10 p-0 bg-transparent border-b border-[#17212B]/15 rounded-none gap-2">
            <TabsTrigger
              value="summary"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="work-logs"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              Work Logs ({workLogs.length})
            </TabsTrigger>
            <TabsTrigger
              value="developers"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              Developer Breakdown
            </TabsTrigger>
            <TabsTrigger
              value="categories"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              Category Breakdown
            </TabsTrigger>
            <TabsTrigger
              value="matrix"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              Developer × Category Matrix
            </TabsTrigger>
            <TabsTrigger
              value="github"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              GitHub Commits ({commits.length})
            </TabsTrigger>
            <TabsTrigger
              value="sync-source"
              className="text-xs font-semibold rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
            >
              Sync / Source Details
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SUMMARY */}
          <TabsContent value="summary" className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Top Developers */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#17212B] pb-2 border-b border-[#17212B]/15">
                  Top Developer Contributions
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#17212B]/15">
                        <TableHead className="text-xs font-semibold text-[#17212B]">Developer</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-[#17212B]">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {developerBreakdown.slice(0, 5).map((d) => (
                        <TableRow key={d.id} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                          <TableCell className="text-xs font-medium py-2.5">{d.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold py-2.5">{d.hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right font-mono text-xs py-2.5">{d.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Categories */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#17212B] pb-2 border-b border-[#17212B]/15">
                  Category Allocation
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#17212B]/15">
                        <TableHead className="text-xs font-semibold text-[#17212B]">Category</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours</TableHead>
                        <TableHead className="text-right text-xs font-semibold text-[#17212B]">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryBreakdown.map((c) => (
                        <TableRow key={c.category} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                          <TableCell className="text-xs font-medium py-2.5">{c.category}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold py-2.5">{c.hours.toFixed(1)}h</TableCell>
                          <TableCell className="text-right font-mono text-xs py-2.5">{c.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: WORK LOGS */}
          <TabsContent value="work-logs" className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#17212B]/15">
                    <TableHead className="w-24 text-xs font-semibold text-[#17212B]">Date</TableHead>
                    <TableHead className="w-36 text-xs font-semibold text-[#17212B]">Developer</TableHead>
                    <TableHead className="w-28 text-xs font-semibold text-[#17212B]">Category</TableHead>
                    <TableHead className="text-xs font-semibold text-[#17212B]">Description</TableHead>
                    <TableHead className="w-24 text-xs font-semibold text-[#17212B]">Ticket ID</TableHead>
                    <TableHead className="w-24 text-right text-xs font-semibold text-[#17212B]">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workLogs.map((log) => (
                    <TableRow key={log.id} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                      <TableCell className="font-mono text-xs whitespace-nowrap py-2.5">{log.date}</TableCell>
                      <TableCell className="text-xs font-medium py-2.5">{log.developerName}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="secondary" className="text-[10px] rounded-full bg-white border border-[#17212B]/15">
                          {log.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#17212B]/90 py-2.5">{log.description}</TableCell>
                      <TableCell className="font-mono text-[11px] text-[#17212B]/75 py-2.5">{log.taskTicketId || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold whitespace-nowrap py-2.5">
                        {log.hours.toFixed(1)}h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 3: DEVELOPER BREAKDOWN */}
          <TabsContent value="developers" className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#17212B]/15">
                    <TableHead className="text-xs font-semibold text-[#17212B]">Developer</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#17212B]">Logged Hours</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#17212B]">Contribution %</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#17212B]">Log Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {developerBreakdown.map((d) => (
                    <TableRow key={d.id} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                      <TableCell className="text-xs font-semibold py-2.5">{d.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold py-2.5">{d.hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5">{d.percentage}%</TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5">{d.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 4: CATEGORY BREAKDOWN */}
          <TabsContent value="categories" className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#17212B]/15">
                    <TableHead className="text-xs font-semibold text-[#17212B]">Category</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours Logged</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#17212B]">Share of Total</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-[#17212B]">Log Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryBreakdown.map((c) => (
                    <TableRow key={c.category} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                      <TableCell className="text-xs font-semibold py-2.5">{c.category}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold py-2.5">{c.hours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5">{c.percentage}%</TableCell>
                      <TableCell className="text-right font-mono text-xs py-2.5">{c.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 5: DEVELOPER X CATEGORY MATRIX */}
          <TabsContent value="matrix" className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[#17212B]/15">
                    <TableHead className="min-w-[140px] text-xs font-semibold text-[#17212B]">Developer</TableHead>
                    {categoriesList.map((cat) => (
                      <TableHead key={cat} className="text-right whitespace-nowrap text-xs font-semibold text-[#17212B]">
                        {cat}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold text-xs text-[#17212B]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(devCategoryMatrix).map(([devName, cats]) => {
                    const totalMin = Object.values(cats).reduce((s, v) => s + v, 0);
                    return (
                      <TableRow key={devName} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                        <TableCell className="text-xs font-semibold py-2.5">{devName}</TableCell>
                        {categoriesList.map((cat) => {
                          const minutes = cats[cat] || 0;
                          return (
                            <TableCell key={cat} className="text-right font-mono text-xs py-2.5">
                              {minutes > 0 ? `${(minutes / 60).toFixed(1)}h` : "—"}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right font-mono text-xs font-bold py-2.5">
                          {(totalMin / 60).toFixed(1)}h
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 6: GITHUB COMMITS */}
          <TabsContent value="github" className="pt-6 space-y-4">
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
          <TabsContent value="sync-source" className="pt-6 space-y-8">
            {/* Connected Repositories */}
            <div className="space-y-3 pb-6 border-b border-[#17212B]/15">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#17212B]">Connected GitHub Repositories</h3>
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
              </div>

              {(!data.config?.githubRepos || data.config.githubRepos.length === 0) ? (
                <div className="p-8 text-center text-xs text-[#17212B]/60">
                  <GitBranch className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  <p>No GitHub repositories currently connected to this project.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#17212B]/15">
                        <TableHead className="text-xs font-semibold text-[#17212B]">Repository</TableHead>
                        <TableHead className="text-xs font-semibold text-[#17212B]">Default Branch</TableHead>
                        <TableHead className="w-24 text-right text-xs font-semibold text-[#17212B]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.config.githubRepos.map((repo: any) => (
                        <TableRow key={`${repo.owner}/${repo.repo}`} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                          <TableCell className="font-mono text-xs font-semibold py-2.5">
                            {repo.owner}/{repo.repo}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#17212B]/75 py-2.5">
                            {repo.defaultBranch || "main"}
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDisconnectRepo(repo.owner, repo.repo)}
                              className="h-7 px-2 text-[#17212B] hover:bg-[#17212B]/10 rounded-full"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Source Sheet Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#17212B]">Google Sheets Source Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
                  <div className="text-[#17212B]/60 text-[10px] uppercase font-semibold">Canonical Project ID</div>
                  <div className="font-bold text-[#17212B] mt-1">{project.id}</div>
                </div>
                <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
                  <div className="text-[#17212B]/60 text-[10px] uppercase font-semibold">Project Code</div>
                  <div className="font-bold text-[#17212B] mt-1">{project.code || "None"}</div>
                </div>
                <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
                  <div className="text-[#17212B]/60 text-[10px] uppercase font-semibold">Total Work Log Rows</div>
                  <div className="font-bold text-[#17212B] mt-1">{workLogs.length}</div>
                </div>
                <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5">
                  <div className="text-[#17212B]/60 text-[10px] uppercase font-semibold">Last Recorded Work Date</div>
                  <div className="font-bold text-[#17212B] mt-1">{project.latestLogDate || "None"}</div>
                </div>
                <div className="p-3 border-l-2 border-[#17212B] bg-[#17212B]/5 sm:col-span-2">
                  <div className="text-[#17212B]/60 text-[10px] uppercase font-semibold">Recognized Aliases</div>
                  <div className="font-bold text-[#17212B] mt-1">{(data.config?.aliases || []).join(", ") || "None"}</div>
                </div>
              </div>
            </div>
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
