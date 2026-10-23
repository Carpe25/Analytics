"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Tag, Search, Calendar, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMonthName } from "@/lib/utils";
import { CategorySummary } from "@/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (selectedMonth && selectedMonth !== "all") {
      query.set("month", selectedMonth);
    }

    fetch(`/api/categories?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCategories(data?.categories || []);
        if (data?.availableMonths) {
          setAvailableMonths(data.availableMonths);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header
        title="Work Categories"
        description="Category time distribution and project utilization dynamically parsed from work logs"
        onSyncComplete={loadCategories}
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
                placeholder="Search categories..."
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

        {/* Flat Categories Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#17212B]/60">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading category reports...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#17212B]/60">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No category logs recorded for {formatMonthName(selectedMonth)}.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#17212B]/20 bg-transparent">
                  <TableHead className="text-xs font-semibold text-[#17212B]">Category Name</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#17212B]">Hours Logged</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-[#17212B]">Share of Month Total</TableHead>
                  <TableHead className="text-center text-xs font-semibold text-[#17212B]">Contributing Developers</TableHead>
                  <TableHead className="text-xs font-semibold text-[#17212B]">Projects Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.name} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5 transition-colors">
                    {/* Category */}
                    <TableCell className="py-3">
                      <span className="font-semibold text-sm text-[#17212B]">{c.name}</span>
                    </TableCell>

                    {/* Hours */}
                    <TableCell className="text-right font-mono font-bold text-sm text-[#17212B] py-3">
                      {c.totalHours.toFixed(1)}h
                    </TableCell>

                    {/* Percentage */}
                    <TableCell className="text-right font-mono text-xs py-3">{c.percentage}%</TableCell>

                    {/* Developers */}
                    <TableCell className="text-center font-mono text-xs py-3">
                      {c.developerCount} {c.developerCount === 1 ? "dev" : "devs"}
                    </TableCell>

                    {/* Projects */}
                    <TableCell className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.projects.map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px]">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
