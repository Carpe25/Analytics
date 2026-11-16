"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Users,
  Tag,
  GitCommit,
  History,
  Settings,
  Clock,
  ShieldCheck,
  ChevronRight,
  Ticket,
  LogOut,
} from "lucide-react";
import { cn, formatDateTimeInTimezone } from "@/lib/utils";
import { useSyncStatus } from "@/lib/events/sync-bus";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Tickets", href: "/tickets", icon: Ticket },
  { label: "Projects", href: "/projects", icon: FolderGit2 },
  { label: "Developers", href: "/developers", icon: Users },
  { label: "Categories", href: "/categories", icon: Tag },
  { label: "GitHub Activity", href: "/github", icon: GitCommit },
  { label: "Sync History", href: "/sync-history", icon: History },
  { label: "Settings / Integrations", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const syncStatus = useSyncStatus();
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (currentUser?.role === "manager") return true;
    // Hide manager-only settings and sync history for developers
    return item.href !== "/settings" && item.href !== "/sync-history";
  }).map((item) => {
    if (item.href === "/developers" && currentUser?.role === "developer") {
      return { ...item, label: "My Profile" };
    }
    return item;
  });

  return (
    <aside className="w-64 border-r border-[#17212B]/15 bg-[#F5F7F8] flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand Header: Aligned with main window Header */}
        <div className="h-[73px] px-6 border-b border-[#17212B]/15 flex items-center shrink-0">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-white border border-[#17212B]/20 shadow-sm flex items-center justify-center text-[#17212B] font-bold text-xs tracking-wider">
              PA
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-[#17212B] leading-none">
                Project Time Analytics
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-3.5 py-2 text-xs font-medium rounded-full transition-all",
                  isActive
                    ? "bg-white text-[#17212B] border border-[#17212B]/15 shadow-sm font-semibold"
                    : "text-[#17212B]/75 hover:bg-white/70 hover:text-[#17212B]"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-[#17212B]/60" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sync Status Footer */}
      <div className="p-4 m-3 rounded-2xl border border-[#17212B]/15 bg-white shadow-sm text-xs text-[#17212B]">
        <div className="flex items-center gap-1.5 font-semibold text-[11px] mb-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>Nightly Sync: 11:59 PM</span>
        </div>
        <div className="text-[10px] text-[#17212B]/75 leading-tight space-y-1">
          <div>Timezone: {syncStatus.timezone || "Asia/Kolkata"}</div>
          <div>
            Last sync:{" "}
            {syncStatus.lastSuccessfulSync
              ? formatDateTimeInTimezone(syncStatus.lastSuccessfulSync, syncStatus.timezone)
              : "Never"}
          </div>
          <div className="flex items-center gap-1 text-[10px] mt-1 text-[#17212B]/90 font-mono">
            <ShieldCheck className="h-3 w-3" />
            <span>{syncStatus.status || "Checking..."}</span>
          </div>
        </div>

        {currentUser && (
          <div className="mt-2.5 pt-2 border-t border-[#17212B]/10 flex items-center justify-between text-[10px]">
            <span className="font-semibold text-[#17212B] truncate max-w-[110px]">{currentUser.name}</span>
            <span className="capitalize px-1.5 py-0.5 rounded-full bg-[#17212B]/5 text-[#17212B]/70 font-mono text-[9px]">
              {currentUser.role}
            </span>
          </div>
        )}

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="w-full mt-3 pt-2.5 border-t border-[#17212B]/10 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#17212B]/70 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
