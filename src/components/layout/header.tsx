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
    <header className="h-[73px] border-b border-[#17212B]/15 bg-[#F5F7F8] px-8 flex items-center justify-between gap-4 shrink-0">
      <div className="flex flex-col justify-center">
        <h1 className="text-lg font-semibold tracking-tight text-[#17212B] leading-tight">{title}</h1>
        {description && (
          <p className="text-xs text-[#17212B]/70 mt-0.5 leading-none">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <SyncButton onSyncComplete={onSyncComplete} />
      </div>
    </header>
  );
}
