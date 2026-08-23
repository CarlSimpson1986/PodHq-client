"use client";

import { useState } from "react";
import type { ExerciseWeeklyPerformance } from "@/lib/coach/exercise-performance";
import { ExerciseTrendChart } from "@/components/exercise-trend-chart";

// Collapsed by default — eleven stacked charts open at once read as
// noisy (Carl's call, 2026-08-23), so this is a plain disclosure toggle
// rather than always-open, matching the same "coming soon, not fake, but
// also not overwhelming" restraint already used elsewhere on this page.
export function ExerciseProgressAccordion({ performanceHistory }: { performanceHistory: ExerciseWeeklyPerformance[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-card-light-border p-4"
      >
        <span className="text-sm font-semibold">Progress by exercise ({performanceHistory.length})</span>
        <span className="text-card-light-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          {performanceHistory.map((performance) => (
            <ExerciseTrendChart key={performance.exerciseKey} performance={performance} />
          ))}
        </div>
      )}
    </div>
  );
}
