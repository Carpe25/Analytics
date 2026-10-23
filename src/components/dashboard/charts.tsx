"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ProjectSummary, DeveloperSummary, CategorySummary } from "@/types";

interface ChartsSectionProps {
  projects: ProjectSummary[];
  developers: DeveloperSummary[];
  categories: CategorySummary[];
}

export function ChartsSection({ projects, developers, categories }: ChartsSectionProps) {
  // Sort and top 5 for neat layout
  const projectData = [...projects]
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 6)
    .map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 12) + "..." : p.name,
      hours: p.totalHours,
    }));

  const developerData = [...developers]
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 6)
    .map((d) => ({
      name: d.name.length > 14 ? d.name.slice(0, 12) + "..." : d.name,
      hours: d.totalHours,
    }));

  const categoryData = [...categories]
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 6)
    .map((c) => ({
      name: c.name.length > 14 ? c.name.slice(0, 12) + "..." : c.name,
      hours: c.totalHours,
    }));

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#17212B] text-[#F5F7F8] p-2 rounded text-xs shadow-md border border-[#17212B]">
          <p className="font-semibold">{label}</p>
          <p className="font-mono mt-0.5">{payload[0].value} hours</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-2 border-b border-[#17212B]/15">
      {/* Project Hours Chart */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#17212B]/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#17212B]">Hours by Project</h3>
        </div>
        <div className="h-60">
          {projectData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#17212B]/50">
              No project hours recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid stroke="rgba(23, 33, 43, 0.1)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#17212B", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(23, 33, 43, 0.2)" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: "#17212B", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(23, 33, 43, 0.2)" }}
                />
                <Tooltip content={customTooltip} />
                <Bar dataKey="hours" fill="#17212B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Developer Hours Chart */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#17212B]/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#17212B]">Hours by Developer</h3>
        </div>
        <div className="h-60">
          {developerData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#17212B]/50">
              No developer hours recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={developerData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid stroke="rgba(23, 33, 43, 0.1)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#17212B", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(23, 33, 43, 0.2)" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: "#17212B", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(23, 33, 43, 0.2)" }}
                />
                <Tooltip content={customTooltip} />
                <Bar dataKey="hours" fill="#17212B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Category Hours Chart */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#17212B]/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#17212B]">Hours by Category</h3>
        </div>
        <div className="h-60">
          {categoryData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#17212B]/50">
              No category hours recorded
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid stroke="rgba(23, 33, 43, 0.1)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#17212B", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(23, 33, 43, 0.2)" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: "#17212B", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(23, 33, 43, 0.2)" }}
                />
                <Tooltip content={customTooltip} />
                <Bar dataKey="hours" fill="#17212B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
