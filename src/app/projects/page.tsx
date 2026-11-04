"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Search,
  ArrowRight,
  GitBranch,
  Plus,
  Calendar,
  Loader2,
  Building2,
  Clock,
  Layers,
  Tag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectRepoDialog } from "@/components/github/connect-repo-dialog";
import { AddClientDialog } from "@/components/clients/add-client-dialog";
import { AddProjectDialog } from "@/components/projects/add-project-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Client } from "@/types";
import { formatMonthName } from "@/lib/utils";

interface ClientProjectBreakdown {
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

interface ClientBreakdown {
  clientName: string;
  totalMinutes: number;
  totalHours: number;
  developerCount: number;
  logCount: number;
  projects: ClientProjectBreakdown[];
}

export default function ProjectsPage() {
  const [clientBreakdown, setClientBreakdown] = useState<ClientBreakdown[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProjectForRepo, setSelectedProjectForRepo] = useState<string | undefined>();
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("breakdown");

  const loadClients = useCallback(() => {
    setLoadingClients(true);
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (data?.clients) setClientsList(data.clients);
      })
      .catch(() => {})
      .finally(() => setLoadingClients(false));
  }, []);

  const loadProjects = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") {
      query.set("month", selectedMonth);
    }
    if (startDate) {
      query.set("startDate", startDate);
    }
    if (endDate) {
      query.set("endDate", endDate);
    }

    fetch(`/api/projects?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setClientBreakdown(data?.clientBreakdown || []);
        if (data?.availableMonths) {
          setAvailableMonths(data.availableMonths);
        }
        if (data?.availableCategories) {
          setAvailableCategories(data.availableCategories);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth, startDate, endDate]);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (!newMonth || newMonth === "all") {
      setStartDate("");
      setEndDate("");
    } else {
      const [yearStr, monthStr] = newMonth.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      const lastDay = new Date(year, monthNum, 0).getDate();
      setStartDate(`${newMonth}-01`);
      setEndDate(`${newMonth}-${String(lastDay).padStart(2, "0")}`);
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setSelectedMonth("all");
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setSelectedMonth("all");
  };

  const [collapsedClients, setCollapsedClients] = useState<Record<string, boolean>>({});

  const toggleClientCollapse = (clientName: string) => {
    setCollapsedClients((prev) => ({
      ...prev,
      [clientName]: !prev[clientName],
    }));
  };

  const handleResetFilters = () => {
    setSelectedMonth("all");
    setSelectedClient("all");
    setSelectedCategory("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
  };

  useEffect(() => {
    loadProjects();
    loadClients();
  }, [loadProjects, loadClients]);

  // Extract all unique client names from current breakdown
  const allClientNames = useMemo(() => {
    return clientBreakdown.map((c) => c.clientName).sort();
  }, [clientBreakdown]);

  // Filter client breakdown by selectedClient, selectedCategory, and search term
  const filteredClientGroups = useMemo(() => {
    const term = search.toLowerCase().trim();

    return clientBreakdown
      .filter((group) => {
        if (selectedClient !== "all" && group.clientName !== selectedClient) {
          return false;
        }
        return true;
      })
      .map((group) => {
        // Filter projects matching category and search term
        const matchingProjects = group.projects.filter((p) => {
          if (selectedCategory !== "all" && !p.categories.includes(selectedCategory)) {
            return false;
          }

          if (!term) return true;

          const clientMatches = group.clientName.toLowerCase().includes(term);
          const nameMatches = p.name.toLowerCase().includes(term);
          const codeMatches = p.code ? p.code.toLowerCase().includes(term) : false;
          const repoMatches = p.connectedRepos.some((r) => r.toLowerCase().includes(term));
          const catMatches = p.categories.some((c) => c.toLowerCase().includes(term));

          return clientMatches || nameMatches || codeMatches || repoMatches || catMatches;
        });

        if (matchingProjects.length === 0) return null;

        const subtotalMinutes = matchingProjects.reduce((sum, p) => sum + p.totalMinutes, 0);
        const subtotalHours = Number((subtotalMinutes / 60).toFixed(1));

        return {
          ...group,
          totalMinutes: subtotalMinutes,
          totalHours: subtotalHours,
          projects: matchingProjects,
        };
      })
      .filter((g): g is ClientBreakdown => g !== null && g.projects.length > 0);
  }, [clientBreakdown, search, selectedClient, selectedCategory]);

  // Overall statistics for active filtered set
  const overallStats = useMemo(() => {
    const totalHours = filteredClientGroups.reduce((sum, g) => sum + g.totalHours, 0);
    const totalProjects = filteredClientGroups.reduce((sum, g) => sum + g.projects.length, 0);
    const clientCount = filteredClientGroups.length;
    return {
      totalHours: Number(totalHours.toFixed(1)),
      totalProjects,
      clientCount,
    };
  }, [filteredClientGroups]);

  return (
    <div className="flex-1 flex flex-col pb-20 w-full font-sans">
      <Header
        title="Project Work Allocation"
        description="Client-wise breakdown, project hours, direct task categories from sheet, and connected GitHub repositories"
        onSyncComplete={loadProjects}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setAddClientOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-white text-[#17212B] border border-[#17212B]/20 rounded-full shadow-sm hover:bg-gray-50"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Add Client</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setAddProjectOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-[#17212B] text-white rounded-full shadow-sm hover:bg-[#17212B]/90"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Project</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedProjectForRepo(undefined);
                setDialogOpen(true);
              }}
              className="gap-1.5 text-xs font-medium bg-white text-[#17212B] border border-[#17212B]/20 rounded-full shadow-sm hover:bg-gray-50"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>Connect Repo</span>
            </Button>
          </div>
        }
      />

      {/* Main Full-Width Content Container (Unboxed & Extended) */}
      <div className="w-full px-8 py-6 space-y-8">
        {/* Top Summary Metrics Strip (Unboxed, Full-Width) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4 border-b border-[#17212B]/15">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" />
              <span>Total Hours Tracked</span>
            </div>
            <div className="text-3xl font-bold font-mono text-[#17212B] mt-1">
              {overallStats.totalHours.toFixed(1)}h
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
              <Building2 className="h-3.5 w-3.5" />
              <span>Active Clients</span>
            </div>
            <div className="text-3xl font-bold font-mono text-[#17212B] mt-1">
              {overallStats.clientCount}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
              <Layers className="h-3.5 w-3.5" />
              <span>Active Projects</span>
            </div>
            <div className="text-3xl font-bold font-mono text-[#17212B] mt-1">
              {overallStats.totalProjects}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" />
              <span>Active Period</span>
            </div>
            <div className="text-base font-semibold text-[#17212B] mt-2">
              {startDate && endDate
                ? `${startDate} to ${endDate}`
                : formatMonthName(selectedMonth)}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-transparent border-b border-[#17212B]/15 rounded-none p-0 w-full justify-start gap-6 h-10">
            <TabsTrigger
              value="breakdown"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent px-2 pb-2 text-xs font-bold text-[#17212B]/60 data-[state=active]:text-[#17212B] gap-2 shadow-none"
            >
              <Layers className="h-4 w-4" />
              <span>Project Work Breakdown</span>
            </TabsTrigger>
            <TabsTrigger
              value="clients"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent px-2 pb-2 text-xs font-bold text-[#17212B]/60 data-[state=active]:text-[#17212B] gap-2 shadow-none"
            >
              <Building2 className="h-4 w-4" />
              <span>Clients Table ({clientsList.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="breakdown" className="space-y-6 mt-0">
            {/* Clean Filter Controls Bar (Curved White Inputs) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#17212B]/15">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#17212B] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-[#17212B]/60" />
                <span>Month:</span>
              </span>
              <div className="w-40">
                <Select
                  value={selectedMonth}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="h-8 text-xs font-medium rounded-full bg-white border-[#17212B]/20"
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

            {/* From Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#17212B]/70">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-34 h-8 text-xs py-0 rounded-full bg-white border-[#17212B]/20 px-3"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#17212B]/70">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-34 h-8 text-xs py-0 rounded-full bg-white border-[#17212B]/20 px-3"
              />
            </div>

            {/* Client Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#17212B] flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-[#17212B]/60" />
                <span>Client:</span>
              </span>
              <div className="w-44">
                <Select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="h-8 text-xs font-medium rounded-full bg-white border-[#17212B]/20"
                >
                  <option value="all">All Clients ({allClientNames.length})</option>
                  {allClientNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#17212B] flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-[#17212B]/60" />
                <span>Category:</span>
              </span>
              <div className="w-44">
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 text-xs font-medium rounded-full bg-white border-[#17212B]/20"
                >
                  <option value="all">All Categories ({availableCategories.length})</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-56">
              <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-[#17212B]/40" />
              <Input
                placeholder="Search projects, clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs rounded-full bg-white border-[#17212B]/20"
              />
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 text-xs rounded-full bg-white border border-[#17212B]/20 shadow-sm hover:bg-gray-50"
            >
              Reset
            </Button>

            {/* Collapse / Expand All Companies */}
            {filteredClientGroups.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allCollapsed = filteredClientGroups.every(
                    (g) => collapsedClients[g.clientName]
                  );
                  const newState: Record<string, boolean> = {};
                  filteredClientGroups.forEach((g) => {
                    newState[g.clientName] = !allCollapsed;
                  });
                  setCollapsedClients(newState);
                }}
                className="h-8 text-xs rounded-full bg-white border border-[#17212B]/20 shadow-sm hover:bg-gray-50"
              >
                {filteredClientGroups.every((g) => collapsedClients[g.clientName])
                  ? "Expand All"
                  : "Collapse All"}
              </Button>
            )}
          </div>

          <div className="text-xs text-[#17212B]/70 flex items-center gap-2 shrink-0">
            <span>Period: <strong>{startDate && endDate ? `${startDate} to ${endDate}` : formatMonthName(selectedMonth)}</strong></span>
            {selectedClient !== "all" && (
              <span>• Client: <strong>{selectedClient}</strong></span>
            )}
            {selectedCategory !== "all" && (
              <span>• Category: <strong>{selectedCategory}</strong></span>
            )}
          </div>
        </div>

        {/* Client-wise Breakdown: Unboxed, Spacious Layout */}
        {loading ? (
          <div className="p-16 text-center text-xs text-[#17212B]/60">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Loading project and client reports...
          </div>
        ) : filteredClientGroups.length === 0 ? (
          <div className="p-16 text-center text-xs text-[#17212B]/60">
            <FolderGit2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No project records match the active filters.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredClientGroups.map((group) => {
              const isCollapsed = !!collapsedClients[group.clientName];
              const clientSharePct =
                overallStats.totalHours > 0
                  ? ((group.totalHours / overallStats.totalHours) * 100).toFixed(1)
                  : "0";

              return (
                <div key={group.clientName} className="space-y-3 pb-8 border-b border-[#17212B]/15 last:border-b-0">
                  {/* Clean, Unboxed Client Header (Collapsible) */}
                  <div
                    onClick={() => toggleClientCollapse(group.clientName)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 cursor-pointer select-none group/client"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-white border border-[#17212B]/20 text-[#17212B] shadow-sm transition-colors group-hover/client:border-[#17212B]/50">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-[#17212B]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[#17212B]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-bold text-lg text-[#17212B] group-hover/client:underline">
                            {group.clientName}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-[11px] font-medium rounded-full bg-white border border-[#17212B]/15 px-2.5"
                          >
                            {group.projects.length} {group.projects.length === 1 ? "project" : "projects"}
                          </Badge>
                          <span className="text-[11px] text-[#17212B]/50 font-normal">
                            {isCollapsed ? "(Click to expand)" : "(Click to collapse)"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#17212B]/65 mt-0.5">
                          <span>{group.logCount} log entries</span>
                          <span>•</span>
                          <span>{clientSharePct}% of total tracked time</span>
                        </div>
                      </div>
                    </div>

                    {/* Prominent Client Total */}
                    <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                      <div className="text-[11px] uppercase tracking-wider text-[#17212B]/60 font-semibold">
                        Total Client Hours
                      </div>
                      <div className="text-2xl font-extrabold font-mono text-[#17212B]">
                        {group.totalHours.toFixed(1)}h
                      </div>
                    </div>
                  </div>

                  {/* Clean Open Projects Table (Visible when not collapsed) */}
                  {!isCollapsed && (
                    <>
                      <div className="overflow-x-auto pt-1">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="border-b border-[#17212B]/15 bg-transparent">
                          <TableHead className="text-xs font-semibold text-[#17212B] py-3">Project</TableHead>
                          <TableHead className="text-right text-xs font-semibold text-[#17212B] py-3 w-48">
                            Hours Worked (% of Client)
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#17212B] py-3">
                            Task Categories (Sheet)
                          </TableHead>
                          <TableHead className="text-center text-xs font-semibold text-[#17212B] py-3">
                            Developers
                          </TableHead>
                          <TableHead className="text-center text-xs font-semibold text-[#17212B] py-3">
                            Entries
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#17212B] py-3">
                            Connected GitHub Repos
                          </TableHead>
                          <TableHead className="text-xs font-semibold text-[#17212B] py-3">
                            Latest Activity
                          </TableHead>
                          <TableHead className="w-12 py-3"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.projects.map((p) => {
                          const projectShareOfClient =
                            group.totalHours > 0
                              ? ((p.totalHours / group.totalHours) * 100).toFixed(1)
                              : "0";

                          return (
                            <TableRow
                              key={`${group.clientName}-${p.id}`}
                              className="border-b border-[#17212B]/10 hover:bg-white/60 transition-colors"
                            >
                              {/* Project Name & Code */}
                              <TableCell className="py-3.5">
                                <Link
                                  href={`/projects/${p.id}`}
                                  className="font-semibold text-sm text-[#17212B] hover:underline"
                                >
                                  {p.name}
                                </Link>
                                {p.code && (
                                  <span className="ml-2 text-[10px] text-[#17212B]/60 font-mono">
                                    [{p.code}]
                                  </span>
                                )}
                              </TableCell>

                              {/* Hours Worked with Visual Share Bar */}
                              <TableCell className="text-right py-3.5">
                                <div className="flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="font-bold text-sm text-[#17212B]">
                                      {p.totalHours.toFixed(1)}h
                                    </span>
                                    <span className="text-[11px] text-[#17212B]/60 font-normal">
                                      ({projectShareOfClient}%)
                                    </span>
                                  </div>
                                  <div className="w-28 h-1.5 bg-[#17212B]/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#17212B] rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, Math.max(0, Number(projectShareOfClient)))}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </TableCell>

                              {/* Task Categories directly from Google Sheet */}
                              <TableCell className="py-3.5">
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {p.categories && p.categories.length > 0 ? (
                                    p.categories.map((cat) => (
                                      <Badge
                                        key={cat}
                                        variant="outline"
                                        className="text-[10px] rounded-full bg-white border-[#17212B]/20 font-normal px-2 py-0"
                                      >
                                        {cat}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-xs text-[#17212B]/40">—</span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Contributing Developers */}
                              <TableCell className="text-center font-mono text-xs py-3.5">
                                {p.developerCount} {p.developerCount === 1 ? "dev" : "devs"}
                              </TableCell>

                              {/* Entries */}
                              <TableCell className="text-center font-mono text-xs py-3.5">
                                {p.logCount}
                              </TableCell>

                              {/* Connected Repos */}
                              <TableCell className="py-3.5">
                                <div className="flex flex-wrap gap-1 items-center">
                                  {p.connectedRepos.length > 0 ? (
                                    p.connectedRepos.map((repo) => (
                                      <Badge
                                        key={repo}
                                        variant="secondary"
                                        className="font-mono text-[10px] rounded-full bg-white border border-[#17212B]/15"
                                      >
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

                              {/* Latest Activity Date */}
                              <TableCell className="font-mono text-xs text-[#17212B]/75 whitespace-nowrap py-3.5">
                                {p.latestLogDate || "—"}
                              </TableCell>

                              {/* Action Link */}
                              <TableCell className="text-right py-3.5">
                                <Link href={`/projects/${p.id}`}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-full hover:bg-white"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Clean Client Subtotal Summary */}
                  <div className="flex items-center justify-between pt-2 text-xs text-[#17212B]/70">
                    <span>
                      Total for <strong>{group.clientName}</strong> across {group.projects.length}{" "}
                      {group.projects.length === 1 ? "project" : "projects"}
                    </span>
                    <span className="font-mono font-bold text-[#17212B] text-sm">
                      {group.totalHours.toFixed(1)} hrs
                    </span>
                  </div>
                </>
              )}
            </div>
              );
            })}
          </div>
        )}
          </TabsContent>

          {/* Dedicated Clients Directory Tab */}
          <TabsContent value="clients" className="space-y-6 mt-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#17212B]/15">
              <div>
                <h3 className="text-base font-bold text-[#17212B]">
                  Client Organizations Directory
                </h3>
                <p className="text-xs text-[#17212B]/70 mt-0.5">
                  Registered clients used for project categorization, work log aggregation, and ticket submissions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setAddClientOpen(true)}
                  className="gap-1.5 text-xs font-semibold bg-white text-[#17212B] border border-[#17212B]/20 rounded-full shadow-sm hover:bg-gray-50"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Add Client</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddProjectOpen(true)}
                  className="gap-1.5 text-xs font-semibold bg-[#17212B] text-white rounded-full shadow-sm hover:bg-[#17212B]/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Project</span>
                </Button>
              </div>
            </div>

            {loadingClients ? (
              <div className="p-12 text-center text-xs text-[#17212B]/60">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#17212B]/50" />
                <span>Loading clients directory...</span>
              </div>
            ) : clientsList.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-[#17212B]/20 rounded-3xl bg-white space-y-3">
                <Building2 className="h-8 w-8 text-[#17212B]/40 mx-auto" />
                <div className="text-sm font-semibold text-[#17212B]">No Clients Registered</div>
                <p className="text-xs text-[#17212B]/60 max-w-sm mx-auto">
                  Add your first client to start organizing projects and routing support tickets.
                </p>
                <Button
                  size="sm"
                  onClick={() => setAddClientOpen(true)}
                  className="gap-1.5 text-xs font-semibold rounded-full mt-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add First Client</span>
                </Button>
              </div>
            ) : (
              <div className="border border-[#17212B]/15 rounded-3xl bg-white overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-[#F5F7F8]">
                    <TableRow className="border-b border-[#17212B]/10">
                      <TableHead className="text-xs font-bold text-[#17212B] py-3.5 pl-6">
                        Client Name
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#17212B] py-3.5">
                        Code
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#17212B] py-3.5">
                        Description
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#17212B] py-3.5">
                        Active Projects
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#17212B] py-3.5 pr-6 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsList.map((client) => {
                      const clientProjects = clientBreakdown.find(
                        (cb) => cb.clientName.toLowerCase() === client.name.toLowerCase()
                      )?.projects || [];

                      return (
                        <TableRow
                          key={client.id}
                          className="border-b border-[#17212B]/10 hover:bg-[#F5F7F8]/40"
                        >
                          <TableCell className="py-4 pl-6">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-xl bg-[#17212B]/5 flex items-center justify-center text-[#17212B] shrink-0 font-bold text-xs">
                                {client.code || client.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-[#17212B]">
                                  {client.name}
                                </div>
                                <div className="text-[10px] text-[#17212B]/50 font-mono">
                                  {client.id}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-4">
                            {client.code ? (
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] font-bold bg-[#17212B]/5 text-[#17212B] border-[#17212B]/20 rounded-md"
                              >
                                {client.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-[#17212B]/40">—</span>
                            )}
                          </TableCell>

                          <TableCell className="py-4 max-w-xs">
                            <span className="text-xs text-[#17212B]/75 line-clamp-1">
                              {client.description || "—"}
                            </span>
                          </TableCell>

                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold rounded-full bg-white border-[#17212B]/20"
                              >
                                {clientProjects.length} {clientProjects.length === 1 ? "project" : "projects"}
                              </Badge>
                              {clientProjects.length > 0 && (
                                <span className="text-[11px] text-[#17212B]/60 truncate max-w-[200px]">
                                  {clientProjects.map((p) => p.name).join(", ")}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="py-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAddProjectOpen(true);
                                }}
                                className="h-7 text-xs font-semibold gap-1 rounded-full border-[#17212B]/20 hover:bg-[#F5F7F8]"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Add Project</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedClient(client.name);
                                  setActiveTab("breakdown");
                                }}
                                className="h-7 text-xs text-[#17212B]/70 hover:text-[#17212B] rounded-full"
                              >
                                <span>View Hours →</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ConnectRepoDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        defaultProjectId={selectedProjectForRepo}
        onSuccess={loadProjects}
      />

      <AddClientDialog
        isOpen={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        onSuccess={() => {
          loadClients();
          loadProjects();
        }}
      />

      <AddProjectDialog
        isOpen={addProjectOpen}
        onClose={() => setAddProjectOpen(false)}
        onSuccess={() => {
          loadProjects();
          loadClients();
        }}
        onOpenAddClient={() => setAddClientOpen(true)}
      />
    </div>
  );
}
