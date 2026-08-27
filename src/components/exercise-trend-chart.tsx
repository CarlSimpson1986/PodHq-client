import type { ExerciseWeeklyPerformance } from "@/lib/coach/exercise-performance";

const WEEKS_WINDOW = 8;
const CHART_HEIGHT = 64;
const CHART_PADDING_Y = 6;
const POINT_GAP = 24;

// Plain hand-rolled SVG — no charting library dependency, matching how
// this app avoids adding a package where a small amount of markup does
// the job (same reasoning as the hand-rolled icon set in icons.tsx).
// Was a bar chart until 2026-08-27 — Carl wanted "where they started vs
// where they are now" as an actual line, not discrete weekly bars, so
// this now draws a single connected polyline through every logged week
// (undated weeks in the middle are skipped, not zero-filled, so the line
// only ever connects real data points) with the start and current weight
// called out at each end.
export function ExerciseTrendChart({ performance }: { performance: ExerciseWeeklyPerformance }) {
  const byWeeksAgo = new Map(performance.weeks.map((w) => [w.weeksAgo, w.maxWeightKg]));
  const points = Array.from({ length: WEEKS_WINDOW }, (_, i) => WEEKS_WINDOW - 1 - i) // oldest (7) -> newest (0)
    .map((weeksAgo, i) => ({ weeksAgo, x: i * POINT_GAP, weightKg: byWeeksAgo.get(weeksAgo) }))
    .filter((p): p is { weeksAgo: number; x: number; weightKg: number } => p.weightKg !== undefined);

  const latest = performance.weeks[0]; // sorted newest-first — see exercise-performance.ts
  const width = (WEEKS_WINDOW - 1) * POINT_GAP;

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-card-light-border p-4">
        <p className="text-sm font-semibold">{performance.exerciseName}</p>
        <p className="mt-3 text-sm text-card-light-muted">No logged sets yet.</p>
      </div>
    );
  }

  const maxWeight = Math.max(...points.map((p) => p.weightKg));
  const minWeight = Math.min(...points.map((p) => p.weightKg));
  const range = maxWeight - minWeight || 1;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const y = (weightKg: number) => CHART_PADDING_Y + plotHeight - ((weightKg - minWeight) / range) * plotHeight;

  const start = points[0];
  const current = points[points.length - 1];
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${y(p.weightKg)}`).join(" ");

  return (
    <div className="rounded-xl border border-card-light-border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{performance.exerciseName}</p>
        {latest && <p className="text-sm text-card-light-muted">{latest.maxWeightKg}kg</p>}
      </div>
      <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="mt-3 w-full" style={{ height: CHART_HEIGHT }}>
        <path d={pathD} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-card-light-foreground" />
        {points.map((p) => (
          <circle key={p.weeksAgo} cx={p.x} cy={y(p.weightKg)} r={p === start || p === current ? 3.5 : 2} className="fill-card-light-foreground" />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-card-light-muted">
        <span>Started {start.weightKg}kg</span>
        <span>Now {current.weightKg}kg</span>
      </div>
    </div>
  );
}
