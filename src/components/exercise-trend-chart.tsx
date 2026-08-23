import type { ExerciseWeeklyPerformance } from "@/lib/coach/exercise-performance";

const WEEKS_WINDOW = 8;
const CHART_HEIGHT = 64;
const BAR_WIDTH = 18;
const BAR_GAP = 6;

// Plain hand-rolled SVG — no charting library dependency for an 8-bar
// trend, matching how this app avoids adding a package where a small
// amount of markup does the job (same reasoning as the hand-rolled icon
// set in icons.tsx).
export function ExerciseTrendChart({ performance }: { performance: ExerciseWeeklyPerformance }) {
  const byWeeksAgo = new Map(performance.weeks.map((w) => [w.weeksAgo, w.maxWeightKg]));
  const maxWeight = Math.max(1, ...performance.weeks.map((w) => w.maxWeightKg));
  const latest = performance.weeks[0]; // sorted newest-first (weeksAgo ascending order reversed) — see exercise-performance.ts
  const width = WEEKS_WINDOW * (BAR_WIDTH + BAR_GAP);

  return (
    <div className="rounded-xl border border-card-light-border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{performance.exerciseName}</p>
        {latest && <p className="text-sm text-card-light-muted">{latest.maxWeightKg}kg</p>}
      </div>
      <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="mt-3 w-full" style={{ height: CHART_HEIGHT }}>
        {Array.from({ length: WEEKS_WINDOW }).map((_, i) => {
          const weeksAgo = WEEKS_WINDOW - 1 - i; // left = oldest (weeksAgo 7), right = this week (weeksAgo 0)
          const weightKg = byWeeksAgo.get(weeksAgo);
          const barHeight = weightKg ? Math.max(2, (weightKg / maxWeight) * CHART_HEIGHT) : 2;
          const x = i * (BAR_WIDTH + BAR_GAP);
          return (
            <rect
              key={weeksAgo}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={BAR_WIDTH}
              height={barHeight}
              rx={2}
              className={weightKg ? "fill-card-light-foreground" : "fill-card-light-border"}
            />
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-card-light-muted">Last {WEEKS_WINDOW} weeks</p>
    </div>
  );
}
