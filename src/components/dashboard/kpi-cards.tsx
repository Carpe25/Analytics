import { CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDateTimeInTimezone } from "@/lib/utils";

interface KpiCardsProps {
  summary: {
    totalHours: number;
    projectCount: number;
    developerCount: number;
    workLogCount: number;
  };
  lastSuccessfulSyncAtUtc?: string;
  sourceStatus?: "connected" | "unconfigured" | "error";
  timezone?: string;
}

export function KpiCards({
  summary,
  lastSuccessfulSyncAtUtc,
  sourceStatus = "connected",
  timezone = "Asia/Kolkata",
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-4 border-b border-[#17212B]/15">
      {/* Total Hours */}
      <div className="flex flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
            Total Logged Hours
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-3xl font-extrabold text-[#17212B] font-mono">
              {summary.totalHours.toFixed(1)}h
            </h3>
          </div>
          <p className="text-[11px] text-[#17212B]/60 mt-0.5">from Google Sheets source</p>
        </div>
      </div>

      {/* Active Projects */}
      <div className="flex flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
            Active Projects
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-3xl font-extrabold text-[#17212B] font-mono">
              {summary.projectCount}
            </h3>
          </div>
          <p className="text-[11px] text-[#17212B]/60 mt-0.5">with logged hours</p>
        </div>
      </div>

      {/* Contributing Developers */}
      <div className="flex flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
            Developers
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-3xl font-extrabold text-[#17212B] font-mono">
              {summary.developerCount}
            </h3>
          </div>
          <p className="text-[11px] text-[#17212B]/60 mt-0.5">active in sheet tabs</p>
        </div>
      </div>

      {/* Total Entries & Sync State */}
      <div className="flex flex-col justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider">
            Work Log Entries
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-3xl font-extrabold text-[#17212B] font-mono">
              {summary.workLogCount}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#17212B]/70 mt-0.5">
            {sourceStatus === "connected" ? (
              <CheckCircle2 className="h-3 w-3 text-[#17212B]" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-[#17212B]" />
            )}
            <span className="truncate">
              {lastSuccessfulSyncAtUtc
                ? `Synced ${formatDateTimeInTimezone(lastSuccessfulSyncAtUtc, timezone)}`
                : "Unsynced"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
