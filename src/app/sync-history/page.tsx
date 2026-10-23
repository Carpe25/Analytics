"use client";

import React, { useEffect, useState } from "react";
import { History, CheckCircle2, AlertTriangle, XCircle, Clock, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDateTimeInTimezone } from "@/lib/utils";
import { SyncRun } from "@/types";

export default function SyncHistoryPage() {
  const [history, setHistory] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const loadHistory = () => {
    setLoading(true);
    fetch("/api/sync/history?limit=100")
      .then((res) => res.json())
      .then((data) => {
        setHistory(data?.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const getStatusIcon = (status: SyncRun["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-[#17212B]" />;
      case "partial":
        return <AlertTriangle className="h-3.5 w-3.5 text-[#17212B]" />;
      case "failed":
        return <XCircle className="h-3.5 w-3.5 text-[#17212B]" />;
      case "running":
        return <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#17212B]" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-[#17212B]" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Sync History"
        description="Audit trail of nightly scheduled jobs and manual synchronization runs"
        onSyncComplete={loadHistory}
      />

      <div className="p-6 space-y-6">
        <Card className="border-[#17212B]/15 bg-[#F5F7F8]">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#17212B]/60">Loading sync history...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#17212B]/60">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No synchronization runs recorded yet. Click "Sync Google Sheets now" to execute a run.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-36">Run ID</TableHead>
                    <TableHead className="w-24">Trigger</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Start Time (IST)</TableHead>
                    <TableHead className="w-24">Duration</TableHead>
                    <TableHead className="text-right">Rows Accepted</TableHead>
                    <TableHead className="text-right">Commits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((run) => {
                    const isExpanded = expandedRunId === run.runId;
                    return (
                      <React.Fragment key={run.runId}>
                        <TableRow
                          className="cursor-pointer hover:bg-[#17212B]/5"
                          onClick={() => setExpandedRunId(isExpanded ? null : run.runId)}
                        >
                          <TableCell className="p-2 text-center">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 opacity-70 inline" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 opacity-70 inline" />
                            )}
                          </TableCell>

                          {/* Run ID */}
                          <TableCell className="font-mono text-xs">{run.runId.slice(0, 16)}...</TableCell>

                          {/* Trigger */}
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {run.triggerType}
                            </Badge>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              {getStatusIcon(run.status)}
                              <span className="capitalize">{run.status}</span>
                            </div>
                          </TableCell>

                          {/* Start Time */}
                          <TableCell className="font-mono text-xs text-[#17212B]/80 whitespace-nowrap">
                            {formatDateTimeInTimezone(run.startedAt)}
                          </TableCell>

                          {/* Duration */}
                          <TableCell className="font-mono text-xs text-[#17212B]/80">
                            {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                          </TableCell>

                          {/* Rows Accepted */}
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {run.rowsAccepted}
                            {run.rowsRejected > 0 && (
                              <span className="text-[10px] text-[#17212B]/60 ml-1 font-normal">
                                ({run.rowsRejected} rej)
                              </span>
                            )}
                          </TableCell>

                          {/* Commits */}
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {run.commitsFetched}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow className="bg-[#17212B]/5">
                            <TableCell colSpan={8} className="p-4 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                                <div>
                                  <div className="font-bold text-[#17212B] mb-1">Sources Attempted:</div>
                                  {run.sourcesAttempted.length > 0 ? (
                                    <ul className="list-disc pl-4 space-y-0.5 text-[#17212B]/80 text-[11px]">
                                      {run.sourcesAttempted.map((s, idx) => (
                                        <li key={idx}>{s}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-[#17212B]/60 italic text-[11px]">None recorded</span>
                                  )}
                                </div>

                                <div>
                                  <div className="font-bold text-[#17212B] mb-1">Counts & Metrics:</div>
                                  <div className="text-[11px] text-[#17212B]/85 space-y-0.5">
                                    <div>Total Rows Read: {run.rowsRead}</div>
                                    <div>Rows Accepted: {run.rowsAccepted}</div>
                                    <div>Rows Ignored (empty): {run.rowsIgnored}</div>
                                    <div>Rows Rejected: {run.rowsRejected}</div>
                                    <div>GitHub Commits Synced: {run.commitsFetched}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Errors & Warnings */}
                              {run.errors.length > 0 && (
                                <div className="p-2.5 rounded border border-[#17212B]/40 bg-[#17212B]/10 text-xs">
                                  <div className="font-bold text-[#17212B] mb-1">Errors:</div>
                                  <ul className="list-disc pl-4 space-y-0.5 text-[#17212B]/90 font-mono text-[11px]">
                                    {run.errors.map((e, idx) => (
                                      <li key={idx}>{e}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {run.warnings.length > 0 && (
                                <div className="p-2.5 rounded border border-[#17212B]/30 bg-[#17212B]/5 text-xs">
                                  <div className="font-bold text-[#17212B] mb-1">Warnings:</div>
                                  <ul className="list-disc pl-4 space-y-0.5 text-[#17212B]/80 font-mono text-[11px]">
                                    {run.warnings.map((w, idx) => (
                                      <li key={idx}>{w}</li>
                                    ))}
                                  </ul>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
