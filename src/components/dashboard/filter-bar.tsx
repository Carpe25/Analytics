"use client";

import React from "react";
import { Download, Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ProjectSummary, DeveloperSummary, CategorySummary, WorkLog } from "@/types";
import { exportWorkLogsToCsv } from "@/lib/export/csv";
import { formatMonthName } from "@/lib/utils";

interface FilterBarProps {
  projects: ProjectSummary[];
  developers: DeveloperSummary[];
  categories: CategorySummary[];
  workLogs: WorkLog[];
  availableMonths?: string[];
  filters: {
    month: string;
    startDate: string;
    endDate: string;
    projectId: string;
    developerId: string;
    category: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
}

export function FilterBar({
  projects,
  developers,
  categories,
  workLogs,
  availableMonths = [],
  filters,
  onFilterChange,
  onReset,
}: FilterBarProps) {
  const handleExportCsv = () => {
    const csvContent = exportWorkLogsToCsv(workLogs);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `work_logs_${filters.month || "all"}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="py-3 border-b border-[#17212B]/15 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[#17212B]" />
          <span className="font-semibold text-[#17212B]">Month:</span>
          <div className="w-40">
            <Select
              value={filters.month}
              onChange={(e) => onFilterChange("month", e.target.value)}
              className="h-8 py-0 font-medium text-xs"
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

        {/* Project Selector */}
        <div className="w-36">
          <Select
            value={filters.projectId}
            onChange={(e) => onFilterChange("projectId", e.target.value)}
            className="h-8 py-0"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Developer Selector */}
        <div className="w-36">
          <Select
            value={filters.developerId}
            onChange={(e) => onFilterChange("developerId", e.target.value)}
            className="h-8 py-0"
          >
            <option value="all">All Developers</option>
            {developers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Category Selector */}
        <div className="w-36">
          <Select
            value={filters.category}
            onChange={(e) => onFilterChange("category", e.target.value)}
            className="h-8 py-0"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Custom Date Range (optional if user wants specific days) */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[#17212B]/60">From:</span>
          <Input
            type="date"
            className="w-32 h-8 text-xs py-0"
            value={filters.startDate}
            onChange={(e) => onFilterChange("startDate", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[#17212B]/60">To:</span>
          <Input
            type="date"
            className="w-32 h-8 text-xs py-0"
            value={filters.endDate}
            onChange={(e) => onFilterChange("endDate", e.target.value)}
          />
        </div>

        <Button variant="ghost" size="sm" onClick={onReset} className="h-8 text-xs text-[#17212B]/75 hover:text-[#17212B]">
          Reset
        </Button>
      </div>

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="h-8 text-xs gap-1.5 font-medium"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export CSV</span>
        </Button>
      </div>
    </div>
  );
}
