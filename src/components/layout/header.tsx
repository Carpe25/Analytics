"use client";

import React from "react";
import { SyncButton } from "@/components/dashboard/sync-button";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  onSyncComplete?: () => void;
}

export function Header({ title, description, actions, onSyncComplete }: HeaderProps) {
  return (
    <header className="border-b border-[#17212B]/15 bg-[#F5F7F8] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[#17212B]">{title}</h1>
        {description && (
          <p className="text-xs text-[#17212B]/70 mt-0.5">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <SyncButton onSyncComplete={onSyncComplete} />
      </div>
    </header>
  );
}
