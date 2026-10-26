"use client";

import React, { useState, useMemo } from "react";
import { ExternalLink, GitCommit, GitBranch, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GitHubCommit } from "@/types";

interface CommitTableProps {
  commits: GitHubCommit[];
  emptyMessage?: string;
}

export function CommitTable({ commits, emptyMessage = "No commits found." }: CommitTableProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Extract all unique branch names from the commits
  const allBranches = useMemo(() => {
    const branchSet = new Set<string>();
    for (const c of commits) {
      if (c.branches && c.branches.length > 0) {
        c.branches.forEach((b) => branchSet.add(b));
      } else if (c.branch) {
        branchSet.add(c.branch);
      }
    }
    return Array.from(branchSet).sort();
  }, [commits]);

  // Filter commits by branch and search text
  const filteredCommits = useMemo(() => {
    return commits.filter((c) => {
      // Branch filter
      if (selectedBranch !== "all") {
        const hasBranch =
          (c.branches && c.branches.includes(selectedBranch)) ||
          c.branch === selectedBranch;
        if (!hasBranch) return false;
      }

      // Search filter
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesMsg = c.message.toLowerCase().includes(term);
        const matchesAuthor = c.authorName.toLowerCase().includes(term);
        const matchesSha = c.shortSha.toLowerCase().includes(term);
        const matchesBranch = (c.branches || [c.branch || ""]).some((b) =>
          b.toLowerCase().includes(term)
        );
        if (!matchesMsg && !matchesAuthor && !matchesSha && !matchesBranch) {
          return false;
        }
      }

      return true;
    });
  }, [commits, selectedBranch, search]);

  if (commits.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-[#17212B]/60">
        <GitCommit className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Branch & Search Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#17212B]/10">
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Selector */}
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-[#17212B]" />
            <span className="text-xs font-semibold text-[#17212B]">Branch:</span>
            <div className="w-52">
              <Select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="h-8 text-xs font-mono"
              >
                <option value="all">All Branches ({allBranches.length})</option>
                {allBranches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Search Commits */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#17212B]/40" />
            <Input
              placeholder="Search commit or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="text-xs text-[#17212B]/70">
          Showing <strong>{filteredCommits.length}</strong> of <strong>{commits.length}</strong> unique commits
        </div>
      </div>

      {filteredCommits.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#17212B]/60">
          <GitCommit className="h-6 w-6 mx-auto mb-2 opacity-40" />
          <p>No commits match the selected branch or search filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#17212B]/15">
                <TableHead className="w-24 text-xs font-semibold">Commit</TableHead>
                <TableHead className="text-xs font-semibold">Message</TableHead>
                <TableHead className="w-44 text-xs font-semibold">Branches</TableHead>
                <TableHead className="w-32 text-xs font-semibold">Author</TableHead>
                <TableHead className="w-36 text-xs font-semibold">Committed (IST)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommits.map((c) => {
                const branchList = c.branches && c.branches.length > 0 ? c.branches : c.branch ? [c.branch] : [];
                return (
                  <TableRow key={`${c.repoFullName}-${c.sha}`} className="border-b border-[#17212B]/10 hover:bg-[#17212B]/5">
                    {/* Short SHA */}
                    <TableCell className="font-mono text-xs py-2.5">
                      <a
                        href={c.commitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline text-[#17212B] font-semibold"
                      >
                        <span>{c.shortSha}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    </TableCell>

                    {/* Message */}
                    <TableCell className="text-xs py-2.5">
                      <div className="font-medium text-[#17212B] line-clamp-1">{c.message.split("\n")[0]}</div>
                    </TableCell>

                    {/* Branches */}
                    <TableCell className="py-2.5">
                      <div className="flex flex-wrap gap-1 items-center max-w-xs">
                        {branchList.slice(0, 2).map((b) => (
                          <span
                            key={b}
                            className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#17212B]/20 bg-[#17212B]/5 text-[#17212B]"
                          >
                            <GitBranch className="h-2.5 w-2.5 opacity-60" />
                            <span className="truncate max-w-[100px]">{b}</span>
                          </span>
                        ))}
                        {branchList.length > 2 && (
                          <span
                            title={branchList.slice(2).join(", ")}
                            className="text-[10px] text-[#17212B]/60 font-mono cursor-help"
                          >
                            +{branchList.length - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Author */}
                    <TableCell className="text-xs py-2.5">
                      <div className="text-[#17212B] font-medium truncate max-w-[120px]">{c.authorName}</div>
                      {c.authorLogin && (
                        <div className="text-[10px] text-[#17212B]/60 font-mono truncate max-w-[120px]">@{c.authorLogin}</div>
                      )}
                    </TableCell>

                    {/* Timestamp */}
                    <TableCell className="text-xs font-mono text-[#17212B]/75 whitespace-nowrap py-2.5">
                      {c.commitDateLocal}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
