"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FolderGit2, GitCommit, FileText, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { ChartsSection } from "@/components/dashboard/charts";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { CommitTable } from "@/components/github/commit-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnalyticsSnapshot } from "@/types";

interface ExtendedAnalyticsSnapshot extends AnalyticsSnapshot {
  availableMonths?: string[];
}

export default function OverviewPage() {
  const [snapshot, setSnapshot] = useState<ExtendedAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);
  const [filters, setFilters] = useState({
    month: "all",
    startDate: "",
    endDate: "",
    projectId: "all",
    developerId: "all",
    category: "all",
  });

  const loadData = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (filters.month && filters.month !== "all") query.set("month", filters.month);
    if (filters.startDate) query.set("startDate", filters.startDate);
    if (filters.endDate) query.set("endDate", filters.endDate);
    if (filters.projectId !== "all") query.set("projectId", filters.projectId);
    if (filters.developerId !== "all") query.set("developerId", filters.developerId);
    if (filters.category !== "all") query.set("category", filters.category);

    fetch(`/api/analytics?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.empty) {
          setIsEmpty(true);
          setSnapshot(null);
        } else {
          setIsEmpty(false);
          setSnapshot(data);
        }
      })
      .catch(() => {
        setIsEmpty(true);
      })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (key: string, val: string) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetFilters = () => {
    setFilters({
      month: "all",
      startDate: "",
      endDate: "",
      projectId: "all",
      developerId: "all",
      category: "all",
    });
  };

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header
        title="Time & Activity Analytics"
        description="Synchronized developer work logs from Google Sheets and connected GitHub commits"
        onSyncComplete={loadData}
      />

      <div className="p-6 max-w-7xl space-y-6">
        {loading && !snapshot ? (
          <div className="p-12 text-center text-xs text-[#17212B]/60">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-50" />
            Loading synchronized analytics...
          </div>
        ) : isEmpty || !snapshot ? (
          <div className="py-12 text-center max-w-xl mx-auto my-8">
            <AlertCircle className="h-8 w-8 mx-auto text-[#17212B]/50 mb-3" />
            <h3 className="text-base font-semibold text-[#17212B]">No Synchronized Report Available Yet</h3>
            <p className="text-xs text-[#17212B]/75 mt-1 max-w-md mx-auto">
              Configure your Google Sheets and GitHub settings, then trigger your first synchronization.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link href="/settings">
                <Button size="sm">Go to Settings & Integrations</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <KpiCards
              summary={snapshot.summary}
              lastSuccessfulSyncAtUtc={snapshot.lastSuccessfulSyncAtUtc}
              sourceStatus={snapshot.sourceStatus}
              timezone={snapshot.displayTimezone}
            />

            {/* Flat Filter Bar with Month Selector */}
            <FilterBar
              projects={snapshot.projects}
              developers={snapshot.developers}
              categories={snapshot.categories}
              workLogs={snapshot.workLogs}
              availableMonths={snapshot.availableMonths || []}
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
            />

            {/* Charts Section */}
            <ChartsSection
              projects={snapshot.projects}
              developers={snapshot.developers}
              categories={snapshot.categories}
            />

            {/* Two Column Layout: Flat, unboxed tables with dividers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
              {/* Recent Logs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#17212B]/15 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#17212B]" />
                    <h3 className="text-sm font-semibold text-[#17212B]">Recent Work Logs</h3>
                  </div>
                  <Link
                    href="/projects"
                    className="text-xs text-[#17212B] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>View all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-[#17212B]/15">
                        <TableHead className="w-20 text-xs">Date</TableHead>
                        <TableHead className="text-xs">Developer</TableHead>
                        <TableHead className="text-xs">Project</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-right text-xs">Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {snapshot.workLogs.slice(0, 7).map((log) => (
                        <TableRow key={log.id} className="border-b border-[#17212B]/10">
                          <TableCell className="font-mono text-xs py-2 whitespace-nowrap">{log.date}</TableCell>
                          <TableCell className="text-xs font-semibold py-2">{log.developerName}</TableCell>
                          <TableCell className="text-xs py-2">{log.projectName}</TableCell>
                          <TableCell className="py-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {log.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold py-2 whitespace-nowrap">
                            {log.hours.toFixed(1)}h
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Recent Commits */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#17212B]/15 pb-2">
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-[#17212B]" />
                    <h3 className="text-sm font-semibold text-[#17212B]">Recent GitHub Commits</h3>
                  </div>
                  <Link
                    href="/github"
                    className="text-xs text-[#17212B] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>View all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <CommitTable commits={snapshot.githubCommits.slice(0, 7)} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
