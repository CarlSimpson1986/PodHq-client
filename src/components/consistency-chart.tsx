import type { WeeklyConsistency } from "@/lib/coach/consistency";

const WEEKS_WINDOW = 8;
const CHART_HEIGHT = 64;
const BAR_WIDTH = 18;
const BAR_GAP = 6;

// Sessions completed per week vs. the member's own sessions_per_week
// goal (coach_profiles) — a dashed target line, not just a bare bar
// chart, so "am I actually hitting my own target" is visible at a
// glance. Same hand-rolled-SVG, no-charting-library approach as
// ExerciseTrendChart.
export function ConsistencyChart({ weeks, targetPerWeek }: { weeks: WeeklyConsistency[]; targetPerWeek: number }) {
  const byWeeksAgo = new Map(weeks.map((w) => [w.weeksAgo, w.sessionsCompleted]));
  const maxCount = Math.max(targetPerWeek, ...weeks.map((w) => w.sessionsCompleted), 1);
  const width = WEEKS_WINDOW * (BAR_WIDTH + BAR_GAP);
  const targetY = CHART_HEIGHT - (targetPerWeek / maxCount) * CHART_HEIGHT;

  return (
    <div className="rounded-xl border border-card-light-border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Consistency</p>
        <p className="text-sm text-card-light-muted">Goal: {targetPerWeek}/week</p>
      </div>
      <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="mt-3 w-full" style={{ height: CHART_HEIGHT }}>
        <line
          x1={0}
          y1={targetY}
          x2={width}
          y2={targetY}
          strokeDasharray="4 3"
          className="stroke-card-light-muted"
          strokeWidth={1}
        />
        {Array.from({ length: WEEKS_WINDOW }).map((_, i) => {
          const weeksAgo = WEEKS_WINDOW - 1 - i;
          const count = byWeeksAgo.get(weeksAgo) ?? 0;
          const barHeight = count > 0 ? Math.max(2, (count / maxCount) * CHART_HEIGHT) : 1;
          const x = i * (BAR_WIDTH + BAR_GAP);
          const metGoal = count >= targetPerWeek;
          return (
            <rect
              key={weeksAgo}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={BAR_WIDTH}
              height={barHeight}
              rx={2}
              className={metGoal ? "fill-success" : count > 0 ? "fill-card-light-foreground" : "fill-card-light-border"}
            />
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-card-light-muted">Sessions per week, last {WEEKS_WINDOW} weeks</p>
    </div>
  );
}
