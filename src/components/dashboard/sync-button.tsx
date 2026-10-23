"use client";

import React, { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SyncButtonProps {
  onSyncComplete?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function SyncButton({ onSyncComplete, variant = "default", size = "default" }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSync = async () => {
    if (loading) return;
    setLoading(true);
    setStatusMessage({ text: "Syncing with Google Sheets & GitHub...", isError: false });

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sync failed. Check connection settings.");
      }

      const rowsCount = data.run?.rowsAccepted ?? 0;
      const commitsCount = data.run?.commitsFetched ?? 0;
      setStatusMessage({
        text: `Sync completed: ${rowsCount} logs accepted, ${commitsCount} commits synced.`,
        isError: false,
      });

      if (onSyncComplete) {
        onSyncComplete();
      }

      // Auto clear message after 5 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to trigger sync", isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant={variant}
        size={size}
        onClick={handleSync}
        disabled={loading}
        className="gap-2 font-medium"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        <span>{loading ? "Syncing..." : "Sync Google Sheets now"}</span>
      </Button>
      {statusMessage && (
        <div className="flex items-center gap-1.5 text-xs text-[#17212B]/80 font-mono">
          {statusMessage.isError ? (
            <AlertCircle className="h-3.5 w-3.5 text-[#17212B]" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#17212B]" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
