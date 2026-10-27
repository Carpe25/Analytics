"use client";

import { useEffect, useState, useCallback } from "react";

export interface SyncCompletedEventDetail {
  timestamp: string;
  runId?: string;
  rowsAccepted?: number;
  commitsFetched?: number;
}

const SYNC_COMPLETED_EVENT = "analytics:sync-completed";

/**
 * Broadcast that a synchronization run has successfully completed.
 * Can be safely called from anywhere in the client.
 */
export function notifySyncCompleted(detail: SyncCompletedEventDetail): void {
  if (typeof window === "undefined") return;
  const event = new CustomEvent<SyncCompletedEventDetail>(SYNC_COMPLETED_EVENT, { detail });
  window.dispatchEvent(event);
}

/**
 * Hook to subscribe to real-time synchronization state.
 * Automatically fetches the initial health/sync status and keeps it updated
 * whenever a manual or scheduled sync completes without needing page reload.
 */
export function useSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<{
    lastSuccessfulSync?: string;
    status: string;
    timezone: string;
    loading: boolean;
  }>({
    lastSuccessfulSync: undefined,
    status: "Checking...",
    timezone: "Asia/Kolkata",
    loading: true,
  });

  const fetchStatus = useCallback(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setSyncStatus({
          lastSuccessfulSync: data?.storage?.lastSuccessfulSyncAtUtc,
          status: data?.storage?.hasLatestSnapshot ? "Snapshot active" : "No snapshot yet",
          timezone: data?.config?.appTimezone || "Asia/Kolkata",
          loading: false,
        });
      })
      .catch(() => {
        setSyncStatus((prev) => ({ ...prev, loading: false }));
      });
  }, []);

  useEffect(() => {
    fetchStatus();

    const handleSyncCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<SyncCompletedEventDetail>;
      if (customEvent.detail?.timestamp) {
        setSyncStatus((prev) => ({
          ...prev,
          lastSuccessfulSync: customEvent.detail.timestamp,
          status: "Snapshot active",
        }));
      }
      // Re-verify with backend health endpoint
      fetchStatus();
    };

    window.addEventListener(SYNC_COMPLETED_EVENT, handleSyncCompleted);
    return () => {
      window.removeEventListener(SYNC_COMPLETED_EVENT, handleSyncCompleted);
    };
  }, [fetchStatus]);

  return {
    ...syncStatus,
    refreshSyncStatus: fetchStatus,
  };
}
