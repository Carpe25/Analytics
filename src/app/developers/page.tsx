"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  Tag,
  Layers,
  FileText,
  Calendar,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DeveloperSummary, WorkLog } from "@/types";

interface DeveloperDetailState {
  developer: DeveloperSummary;
  projectBreakdown: { id: string; name: string; hours: number; percentage: number; count: number }[];
  categoryBreakdown: { category: string; hours: number; percentage: number; count: number }[];
  projectCategoryMatrix: Record<string, Record<string, number>>;
  workLogs: WorkLog[];
  availableMonths: string[];
  selectedMonth: string;
}

import { formatMonthName } from "@/lib/utils";

export default function DevelopersPage() {
  const [developers, setDevelopers] = useState<DeveloperSummary[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Expanded developer detail state
  const [expandedDevId, setExpandedDevId] = useState<string | null>(null);
  const [devDetails, setDevDetails] = useState<Record<string, DeveloperDetailState>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const loadDevelopers = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") {
      query.set("month", selectedMonth);
    }

    fetch(`/api/developers?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setDevelopers(data?.developers || []);
        if (data?.availableMonths) {
          setAvailableMonths(data.availableMonths);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  useEffect(() => {
    loadDevelopers();
  }, [loadDevelopers]);

  const fetchDeveloperDetail = async (devId: string, month: string) => {
    setLoadingDetail(devId);
    try {
      const query = month && month !== "all" ? `?month=${month}` : "";
      const res = await fetch(`/api/developers/${devId}${query}`);
      const data = await res.json();
      if (!data.error) {
        setDevDetails((prev) => ({ ...prev, [devId]: data }));
      }
    } catch (err) {
      console.error("Failed to load developer breakdown:", err);
    } finally {
      setLoadingDetail(null);
    }
  };

  const toggleExpand = async (devId: string) => {
    if (expandedDevId === devId) {
      setExpandedDevId(null);
      return;
    }

    setExpandedDevId(devId);
    await fetchDeveloperDetail(devId, selectedMonth);
  };

  const handleDevMonthChange = async (devId: string, newMonth: string) => {
    await fetchDeveloperDetail(devId, newMonth);
  };

  const filtered = developers.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.projects.some((p) => p.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header
        title="Developer Work Analytics"
        description="Monthly hours, project allocation, and category breakdowns for each team member"
        onSyncComplete={loadDevelopers}
      />

      <div className="p-6 max-w-7xl space-y-6">
        {/* Controls Bar: Flat, airy layout without boxy containers */}
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
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setDevDetails({}); // refresh cached detail views with new month
                  }}
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
                placeholder="Search developer..."
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

        {/* Developers Table: Flat, Open Layout without heavy card borders */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#17212B]/60">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading developer reports...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#17212B]/60">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No developer logs found for {formatMonthName(selectedMonth)}.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#17212B]/20 bg-transparent">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="text-xs font-semibold text-[#17212B]">Developer</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#17212B]">Logged Hours</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-[#17212B]">Projects</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-[#17212B]">Latest Work Date</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#17212B]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const isExpanded = expandedDevId === d.id;
                  const detail = devDetails[d.id];
                  const isFetching = loadingDetail === d.id;
                  const currentDetailMonth = detail?.selectedMonth || selectedMonth;
                  const allCategories = detail?.categoryBreakdown.map((c) => c.category) || [];

                  return (
                    <React.Fragment key={d.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-[#17212B]/5 border-b border-[#17212B]/10 transition-colors"
                        onClick={() => toggleExpand(d.id)}
                      >
                        {/* Chevron */}
                        <TableCell className="p-3 text-center">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[#17212B] inline" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#17212B]/50 inline" />
                          )}
                        </TableCell>

                        {/* Clean Developer Display Name */}
                        <TableCell className="p-3">
                          <span className="font-semibold text-sm text-[#17212B]">{d.name}</span>
                        </TableCell>

                        {/* Logged Hours */}
                        <TableCell className="p-3 text-right font-mono font-bold text-sm text-[#17212B]">
                          {d.totalHours.toFixed(1)}h
                        </TableCell>

                        {/* Projects Count */}
                        <TableCell className="p-3 text-center font-mono text-xs text-[#17212B]">
                          {d.projectCount} {d.projectCount === 1 ? "project" : "projects"}
                        </TableCell>

                        {/* Latest Date */}
                        <TableCell className="p-3 text-center font-mono text-xs text-[#17212B]/75 whitespace-nowrap">
                          {d.latestLogDate || "—"}
                        </TableCell>

                        {/* Action Link */}
                        <TableCell className="p-3 text-right">
                          <span className="text-xs underline font-medium text-[#17212B]">
                            {isExpanded ? "Hide Details" : "View Breakdown"}
                          </span>
                        </TableCell>
                      </TableRow>

                      {/* EXPANDED DETAILED BREAKDOWN (FLAT LAYOUT) */}
                      {isExpanded && (
                        <TableRow className="bg-[#17212B]/[0.02] border-b border-[#17212B]/20">
                          <TableCell colSpan={6} className="p-6">
                            {isFetching ? (
                              <div className="p-8 text-center text-xs text-[#17212B]/60">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                Loading breakdown for {d.name}...
                              </div>
                            ) : !detail ? (
                              <div className="p-4 text-xs text-[#17212B]/60">
                                No breakdown data available.
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Monthly Switcher & Overview Header for Developer */}
                                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#17212B]/15">
                                  <div>
                                    <h3 className="text-sm font-bold text-[#17212B]">
                                      {d.name} — Work Allocation
                                    </h3>
                                    <p className="text-xs text-[#17212B]/70 mt-0.5">
                                      Total Logged: <strong>{detail.developer.totalHours.toFixed(1)} hours</strong> across{" "}
                                      <strong>{detail.projectBreakdown.length} projects</strong> in{" "}
                                      <strong>{detail.categoryBreakdown.length} categories</strong> ({detail.workLogs.length} entries)
                                    </p>
                                  </div>

                                  {/* Filter month specifically for this developer */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-[#17212B]">View Month:</span>
                                    <div className="w-44">
                                      <Select
                                        value={currentDetailMonth}
                                        onChange={(e) => handleDevMonthChange(d.id, e.target.value)}
                                        className="h-8 text-xs font-medium"
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
                                </div>

                                {/* Tabs for Projects, Categories, Matrix, and Logs */}
                                <Tabs defaultValue="projects" className="w-full">
                                  <TabsList className="h-9 justify-start bg-transparent border-b border-[#17212B]/15 rounded-none p-0 w-full gap-2">
                                    <TabsTrigger
                                      value="projects"
                                      className="text-xs font-semibold gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
                                    >
                                      <FolderGit2 className="h-3.5 w-3.5" />
                                      <span>Projects ({detail.projectBreakdown.length})</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="categories"
                                      className="text-xs font-semibold gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
                                    >
                                      <Tag className="h-3.5 w-3.5" />
                                      <span>Categories ({detail.categoryBreakdown.length})</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="matrix"
                                      className="text-xs font-semibold gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
                                    >
                                      <Layers className="h-3.5 w-3.5" />
                                      <span>Project × Category Matrix</span>
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="logs"
                                      className="text-xs font-semibold gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-[#17212B] data-[state=active]:bg-transparent data-[state=active]:text-[#17212B] px-3 py-2"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      <span>Work Logs ({detail.workLogs.length})</span>
                                    </TabsTrigger>
                                  </TabsList>

                                  {/* 1. PROJECTS BREAKDOWN */}
                                  <TabsContent value="projects" className="pt-4">
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="border-b border-[#17212B]/15">
                                            <TableHead className="text-xs font-semibold text-[#17212B]">Project Name</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours Worked</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-[#17212B]">% of {d.name}'s Time</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-[#17212B]">Entries</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {detail.projectBreakdown.map((p) => (
                                            <TableRow key={p.id} className="border-b border-[#17212B]/10">
                                              <TableCell className="text-xs font-medium py-2.5">{p.name}</TableCell>
                                              <TableCell className="text-right font-mono text-xs font-bold py-2.5">{p.hours.toFixed(1)}h</TableCell>
                                              <TableCell className="text-right font-mono text-xs py-2.5">{p.percentage}%</TableCell>
                                              <TableCell className="text-right font-mono text-xs py-2.5">{p.count}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TabsContent>

                                  {/* 2. CATEGORIES BREAKDOWN */}
                                  <TabsContent value="categories" className="pt-4">
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="border-b border-[#17212B]/15">
                                            <TableHead className="text-xs font-semibold text-[#17212B]">Category</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours Logged</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-[#17212B]">% Share</TableHead>
                                            <TableHead className="text-right text-xs font-semibold text-[#17212B]">Entries</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {detail.categoryBreakdown.map((c) => (
                                            <TableRow key={c.category} className="border-b border-[#17212B]/10">
                                              <TableCell className="text-xs font-medium py-2.5">{c.category}</TableCell>
                                              <TableCell className="text-right font-mono text-xs font-bold py-2.5">{c.hours.toFixed(1)}h</TableCell>
                                              <TableCell className="text-right font-mono text-xs py-2.5">{c.percentage}%</TableCell>
                                              <TableCell className="text-right font-mono text-xs py-2.5">{c.count}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TabsContent>

                                  {/* 3. PROJECT × CATEGORY MATRIX */}
                                  <TabsContent value="matrix" className="pt-4">
                                    <div className="overflow-x-auto">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="border-b border-[#17212B]/15">
                                            <TableHead className="text-xs font-semibold text-[#17212B] min-w-[160px]">
                                              Project \ Category
                                            </TableHead>
                                            {allCategories.map((cat) => (
                                              <TableHead key={cat} className="text-right text-xs font-semibold text-[#17212B] whitespace-nowrap">
                                                {cat}
                                              </TableHead>
                                            ))}
                                            <TableHead className="text-right text-xs font-bold text-[#17212B]">
                                              Total
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {Object.entries(detail.projectCategoryMatrix).map(([projName, cats]) => {
                                            const totalMin = Object.values(cats).reduce((sum, v) => sum + v, 0);
                                            return (
                                              <TableRow key={projName} className="border-b border-[#17212B]/10">
                                                <TableCell className="text-xs font-medium py-2.5">{projName}</TableCell>
                                                {allCategories.map((cat) => {
                                                  const min = cats[cat] || 0;
                                                  return (
                                                    <TableCell key={cat} className="text-right font-mono text-xs py-2.5">
                                                      {min > 0 ? `${(min / 60).toFixed(1)}h` : "—"}
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

                                  {/* 4. WORK LOGS AUDIT TRAIL */}
                                  <TabsContent value="logs" className="pt-4">
                                    <div className="max-h-80 overflow-y-auto">
                                      <Table>
                                        <TableHeader className="sticky top-0 bg-[#F5F7F8] z-10 border-b border-[#17212B]/15">
                                          <TableRow>
                                            <TableHead className="text-xs w-24">Date</TableHead>
                                            <TableHead className="text-xs w-36">Project</TableHead>
                                            <TableHead className="text-xs w-28">Category</TableHead>
                                            <TableHead className="text-xs">Description</TableHead>
                                            <TableHead className="text-xs w-20 text-right">Hours</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {detail.workLogs.map((log) => (
                                            <TableRow key={log.id} className="border-b border-[#17212B]/10">
                                              <TableCell className="font-mono text-xs py-2 whitespace-nowrap">{log.date}</TableCell>
                                              <TableCell className="text-xs font-medium py-2">{log.projectName}</TableCell>
                                              <TableCell className="py-2">
                                                <Badge variant="secondary" className="text-[10px]">
                                                  {log.category}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-xs text-[#17212B]/85 py-2">{log.description}</TableCell>
                                              <TableCell className="text-right font-mono text-xs font-semibold py-2 whitespace-nowrap">
                                                {log.hours.toFixed(1)}h
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
