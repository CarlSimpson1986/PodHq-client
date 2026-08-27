"use client";

import { useState } from "react";
import { HealthTrendLine } from "@/components/health-trend-line";

// Expandable "current value + trend on demand" card — resting heart
// rate and HRV both use this as-is; collapsed by default so Health
// isn't a wall of charts on first load.
export function HealthMetricCard({
  label,
  unit,
  current,
  points,
}: {
  label: string;
  unit: string;
  current: number | null;
  points: { date: string; value: number }[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card-light">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between p-5 text-left">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{current !== null ? `${current}${unit}` : "—"}</p>
        </div>
        <span className="text-xl text-card-light-muted">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="border-t border-card-light-border px-5 pb-5 pt-4">
          <HealthTrendLine points={points} />
          <p className="mt-1 text-xs text-card-light-muted">Last {points.length} days with data</p>
        </div>
      )}
    </div>
  );
}
