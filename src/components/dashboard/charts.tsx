"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ProjectSummary, DeveloperSummary, CategorySummary } from "@/types";

interface ChartsSectionProps {
  projects: ProjectSummary[];
  developers: DeveloperSummary[];
  categories: CategorySummary[];
}

const BLUE_PALETTE = [
  "#1D4ED8", // blue-700
  "#2563EB", // blue-600
  "#3B82F6", // blue-500
  "#60A5FA", // blue-400
  "#93C5FD", // blue-300
  "#0284C7", // sky-600
  "#38BDF8", // sky-400
];

function prepareTopSlices(items: { name: string; hours: number }[], maxSlices = 5) {
  const sorted = [...items].filter((i) => i.hours > 0).sort((a, b) => b.hours - a.hours);
  if (sorted.length <= maxSlices) {
    return sorted;
  }
  const top = sorted.slice(0, maxSlices);
  const remainingHours = Number(
    sorted.slice(maxSlices).reduce((s, i) => s + i.hours, 0).toFixed(1)
  );
  if (remainingHours > 0) {
    top.push({ name: "Others", hours: remainingHours });
  }
  return top;
}

export function ChartsSection({ projects, developers, categories }: ChartsSectionProps) {
  const projectData = prepareTopSlices(
    projects.map((p) => ({
      name: p.name,
      hours: Number(p.totalHours.toFixed(1)),
    }))
  );

  const developerData = prepareTopSlices(
    developers.map((d) => ({
      name: d.name,
      hours: Number(d.totalHours.toFixed(1)),
    }))
  );

  const categoryData = prepareTopSlices(
    categories.map((c) => ({
      name: c.name,
      hours: Number(c.totalHours.toFixed(1)),
    }))
  );

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-white text-[#17212B] p-2.5 rounded-xl border border-[#17212B]/20 shadow-lg text-xs font-sans">
          <p className="font-semibold text-xs">{item.name}</p>
          <p className="font-mono mt-0.5 text-blue-600 font-bold text-sm">
            {item.value} hours
          </p>
        </div>
      );
    }
    return null;
  };

  const renderPieCard = (
    title: string,
    data: { name: string; hours: number }[],
    emptyMessage: string
  ) => {
    const totalHours = Number(data.reduce((s, i) => s + i.hours, 0).toFixed(1));

    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#17212B]/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#17212B]">{title}</h3>
          <span className="font-mono text-xs font-semibold text-[#17212B]/70">{totalHours}h</span>
        </div>

        {data.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-xs text-[#17212B]/50">
            {emptyMessage}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={customTooltip} />
                  <Pie
                    data={data}
                    dataKey="hours"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    paddingAngle={3}
                    stroke="#F5F7F8"
                    strokeWidth={2}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={BLUE_PALETTE[index % BLUE_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Clean White & Blue Legend */}
            <div className="w-full flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-2 px-1">
              {data.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: BLUE_PALETTE[idx % BLUE_PALETTE.length] }}
                  />
                  <span className="text-[#17212B]/80 truncate max-w-[90px]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="font-mono font-semibold text-[#17212B]">{item.hours}h</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-4 border-b border-[#17212B]/15">
      {renderPieCard("Hours by Project", projectData, "No project hours recorded")}
      {renderPieCard("Hours by Developer", developerData, "No developer hours recorded")}
      {renderPieCard("Hours by Category", categoryData, "No category hours recorded")}
    </div>
  );
}
