"use client";

import { useState } from "react";
import { HealthTrendLine } from "@/components/health-trend-line";

// Expandable "current value + trend on demand" card — resting heart
// rate, HRV and sleep all use this as-is; collapsed by default so Health
// isn't a wall of charts on first load. `format` overrides the plain
// "${value}${unit}" rendering for a value that isn't a bare number
// (sleep's "7h 7m" via formatDuration) — optional so steps/RHR/HRV
// (still using the number+unit shape) don't need to pass one.
export function HealthMetricCard({
  label,
  unit,
  current,
  points,
  weeklyAvg,
  monthlyAvg,
  format,
}: {
  label: string;
  unit: string;
  current: number | null;
  points: { date: string; value: number }[];
  weeklyAvg?: number | null;
  monthlyAvg?: number | null;
  format?: (value: number) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const render = (value: number) => (format ? format(value) : `${Math.round(value)}${unit}`);

  return (
    <div className="card-light">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between p-5 text-left">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{current !== null ? render(current) : "—"}</p>
          {(weeklyAvg !== null && weeklyAvg !== undefined) || (monthlyAvg !== null && monthlyAvg !== undefined) ? (
            <p className="mt-1 text-xs text-card-light-muted">
              {weeklyAvg !== null && weeklyAvg !== undefined ? `7-day avg ${render(weeklyAvg)}` : null}
              {weeklyAvg !== null && weeklyAvg !== undefined && monthlyAvg !== null && monthlyAvg !== undefined ? " · " : null}
              {monthlyAvg !== null && monthlyAvg !== undefined ? `30-day avg ${render(monthlyAvg)}` : null}
            </p>
          ) : null}
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
