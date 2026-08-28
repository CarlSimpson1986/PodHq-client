"use client";

import { useState } from "react";
import { HealthTrendLine } from "@/components/health-trend-line";

function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

// Expandable "current value + trend on demand" card — resting heart
// rate, HRV and sleep all use this as-is; collapsed by default so Health
// isn't a wall of charts on first load. `formatAs` selects a rendering
// mode other than the plain "${value}${unit}" shape (sleep's "7h 7m").
// A string flag, not a function prop — this is a Client Component
// ("use client" above) invoked from health/page.tsx, a Server Component;
// Next.js can't serialize a function across that boundary (it throws a
// generic, unhelpful production error — minified React #441 — rather
// than a clear message, found live 2026-08-28), so the formatter itself
// has to live in this file, picked by a plain string the server side can
// safely pass.
export function HealthMetricCard({
  label,
  unit,
  current,
  points,
  weeklyAvg,
  monthlyAvg,
  formatAs,
}: {
  label: string;
  unit: string;
  current: number | null;
  points: { date: string; value: number }[];
  weeklyAvg?: number | null;
  monthlyAvg?: number | null;
  formatAs?: "duration";
}) {
  const [expanded, setExpanded] = useState(false);
  const render = (value: number) => (formatAs === "duration" ? formatDuration(value) : `${Math.round(value)}${unit}`);

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
