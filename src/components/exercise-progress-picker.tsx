"use client";

import { useState } from "react";
import type { ExerciseWeeklyPerformance } from "@/lib/coach/exercise-performance";
import { ExerciseTrendChart } from "@/components/exercise-trend-chart";

// Dropdown-driven single chart — replaces ExerciseProgressAccordion's
// all-exercises-stacked pattern for the redesigned Training tab (the
// brief's "select an exercise, see its 8-week chart" UX, which nothing in
// this app had before). ExerciseTrendChart itself is unchanged/reused —
// still renders on its own white card-light surface internally, so this
// wraps it in a bare .card-light div rather than restyling the chart.
export function ExerciseProgressPicker({ performanceHistory }: { performanceHistory: ExerciseWeeklyPerformance[] }) {
  const [selectedKey, setSelectedKey] = useState(performanceHistory[0]?.exerciseKey ?? "");
  const selected = performanceHistory.find((p) => p.exerciseKey === selectedKey) ?? performanceHistory[0];

  return (
    <div className="space-y-3">
      <select
        value={selectedKey}
        onChange={(e) => setSelectedKey(e.target.value)}
        className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground"
      >
        {performanceHistory.map((p) => (
          <option key={p.exerciseKey} value={p.exerciseKey}>
            {p.exerciseName}
          </option>
        ))}
      </select>
      {selected && (
        <div className="card-light">
          <ExerciseTrendChart performance={selected} />
        </div>
      )}
    </div>
  );
}
