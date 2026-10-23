"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FolderGit2, Search, ArrowRight, GitBranch, Plus, Calendar, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectRepoDialog } from "@/components/github/connect-repo-dialog";
import { formatMonthName } from "@/lib/utils";
import { ProjectSummary } from "@/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectForRepo, setSelectedProjectForRepo] = useState<string | undefined>();

  const loadProjects = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") {
      query.set("month", selectedMonth);
    }

    fetch(`/api/projects?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setProjects(data?.projects || []);
        if (data?.availableMonths) {
          setAvailableMonths(data.availableMonths);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filteredProjects = projects.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      p.connectedRepos.some((r) => r.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header
        title="Project Work Allocation"
        description="Consolidated project-level hours, developer contributions, and connected GitHub repositories"
        onSyncComplete={loadProjects}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedProjectForRepo(undefined);
              setDialogOpen(true);
            }}
            className="gap-1.5 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect GitHub Repository</span>
          </Button>
        }
      />

      <div className="p-6 max-w-7xl space-y-6">
        {/* Flat Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#17212B]/15">
          <div className="flex items-center gap-3">
            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#17212B] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>Month:</span>
              </span>
              <div className="w-48">
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-9 text-xs font-medium"
                >
                  <option value="all">All Months</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthName(m)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#17212B]/40" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          <div className="text-xs text-[#17212B]/70">
            Showing records for: <strong>{formatMonthName(selectedMonth)}</strong>
          </div>
        </div>

        {/* Flat Projects Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#17212B]/60">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading project reports...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#17212B]/60">
              <FolderGit2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No project logs recorded for {formatMonthName(selectedMonth)}.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#17212B]/20 bg-transparent">
                  <TableHead className="text-xs font-semibold text-[#17212B]">Project</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours Worked</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-[#17212B]">Contributing Developers</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-[#17212B]">Entries</TableHead>
                  <TableHead className="text-xs font-semibold text-[#17212B]">Connected GitHub Repositories</TableHead>
                  <TableHead className="text-xs font-semibold text-[#17212B]">Latest Activity</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((p) => (
                  <TableRow key={p.id} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5 transition-colors">
                    {/* Name */}
                    <TableCell className="py-3">
                      <div className="font-semibold text-sm text-[#17212B]">{p.name}</div>
                      {p.code && (
                        <span className="text-[10px] text-[#17212B]/60 font-mono">[{p.code}]</span>
                      )}
                    </TableCell>

                    {/* Total Hours */}
                    <TableCell className="text-right font-mono font-bold text-sm text-[#17212B] py-3">
                      {p.totalHours.toFixed(1)}h
                    </TableCell>

                    {/* Developer Count */}
                    <TableCell className="text-center font-mono text-xs py-3">
                      {p.developerCount} {p.developerCount === 1 ? "developer" : "developers"}
                    </TableCell>

                    {/* Log Count */}
                    <TableCell className="text-center font-mono text-xs py-3">{p.logCount}</TableCell>

                    {/* Connected Repos */}
                    <TableCell className="py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {p.connectedRepos.length > 0 ? (
                          p.connectedRepos.map((repo) => (
                            <Badge key={repo} variant="secondary" className="font-mono text-[10px]">
                              {repo}
                            </Badge>
                          ))
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedProjectForRepo(p.id);
                              setDialogOpen(true);
                            }}
                            className="text-[11px] text-[#17212B]/60 hover:text-[#17212B] underline flex items-center gap-1"
                          >
                            <GitBranch className="h-3 w-3" />
                            <span>Connect repo</span>
                          </button>
                        )}
                      </div>
                    </TableCell>

                    {/* Latest Activity */}
                    <TableCell className="font-mono text-xs text-[#17212B]/75 whitespace-nowrap py-3">
                      {p.latestLogDate || p.latestCommitDate || "—"}
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right py-3">
                      <Link href={`/projects/${p.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <ConnectRepoDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        defaultProjectId={selectedProjectForRepo}
        onSuccess={loadProjects}
      />
    </div>
  );
}
