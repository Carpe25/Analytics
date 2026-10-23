"use client";

import React, { useEffect, useState, useCallback } from "react";
import { GitCommit, Search, Plus, Filter, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CommitTable } from "@/components/github/commit-table";
import { ConnectRepoDialog } from "@/components/github/connect-repo-dialog";
import { GitHubCommit } from "@/types";

export default function GitHubActivityPage() {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [repositories, setRepositories] = useState<{ repoFullName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [filters, setFilters] = useState({
    repo: "all",
    author: "",
    startDate: "",
    endDate: "",
  });

  const loadCommits = useCallback(() => {
    setLoading(true);
    const query = new URLSearchParams();
    if (filters.repo !== "all") query.set("repo", filters.repo);
    if (filters.author) query.set("author", filters.author);
    if (filters.startDate) query.set("startDate", filters.startDate);
    if (filters.endDate) query.set("endDate", filters.endDate);

    fetch(`/api/github/commits?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setCommits(data?.commits || []);
        if (data?.repositories) setRepositories(data.repositories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    loadCommits();
  }, [loadCommits]);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="GitHub Activity"
        description="Synchronized commit logs across all mapped project repositories"
        onSyncComplete={loadCommits}
        actions={
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Connect Repository</span>
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="py-2 border-b border-[#17212B]/15 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#17212B]">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Repo */}
          <div className="w-48">
            <Select
              value={filters.repo}
              onChange={(e) => setFilters((prev) => ({ ...prev, repo: e.target.value }))}
              className="h-8 py-0"
            >
              <option value="all">All Repositories</option>
              {repositories.map((r) => (
                <option key={r.repoFullName} value={r.repoFullName}>
                  {r.repoFullName}
                </option>
              ))}
            </Select>
          </div>

          {/* Author */}
          <div className="w-44">
            <Input
              placeholder="Filter by author..."
              value={filters.author}
              onChange={(e) => setFilters((prev) => ({ ...prev, author: e.target.value }))}
              className="h-8 text-xs py-0"
            />
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[#17212B]/70">From:</span>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="w-32 h-8 text-xs py-0"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[#17212B]/70">To:</span>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="w-32 h-8 text-xs py-0"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ repo: "all", author: "", startDate: "", endDate: "" })}
            className="h-8 text-xs"
          >
            Reset
          </Button>
        </div>

        {/* Commits Table */}
        {loading ? (
          <div className="p-12 text-center text-xs text-[#17212B]/60">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 opacity-50" />
            Loading GitHub commits...
          </div>
        ) : (
          <CommitTable
            commits={commits}
            emptyMessage="No GitHub commits match the selected filters or no repositories have been synchronized."
          />
        )}
      </div>

      <ConnectRepoDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={loadCommits}
      />
    </div>
  );
}
