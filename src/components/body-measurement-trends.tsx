import { HealthTrendLine } from "@/components/health-trend-line";

interface BodyMeasurementPoint {
  recordedDate: string;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
}

// Weekly weigh-in trend (2026-08-30) — three small charts, each reusing
// HealthTrendLine (already handles the 0/1/2+-point states). Each metric
// is hidden entirely when nobody's ever logged it — showing an empty
// "not enough data" chart for a measurement the member has never once
// answered (waist/hip especially, since both are optional every week)
// would just be clutter, not a genuine "keep going" prompt the way it is
// for weight once at least one point exists.
export function BodyMeasurementTrends({ history }: { history: BodyMeasurementPoint[] }) {
  const weightPoints = history.filter((h) => h.weightKg !== null).map((h) => ({ date: h.recordedDate, value: h.weightKg! }));
  const waistPoints = history.filter((h) => h.waistCm !== null).map((h) => ({ date: h.recordedDate, value: h.waistCm! }));
  const hipPoints = history.filter((h) => h.hipCm !== null).map((h) => ({ date: h.recordedDate, value: h.hipCm! }));

  if (weightPoints.length === 0 && waistPoints.length === 0 && hipPoints.length === 0) return null;

  return (
    <div className="space-y-4">
      {weightPoints.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Weight trend</p>
          <HealthTrendLine points={weightPoints} />
        </div>
      )}
      {waistPoints.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Waist trend</p>
          <HealthTrendLine points={waistPoints} />
        </div>
      )}
      {hipPoints.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Hip trend</p>
          <HealthTrendLine points={hipPoints} />
        </div>
      )}
    </div>
  );
}
