"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isIsolatedPage = pathname === "/raise-ticket" || pathname === "/login";

  if (isIsolatedPage) {
    return <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">{children}</main>
    </>
  );
}
