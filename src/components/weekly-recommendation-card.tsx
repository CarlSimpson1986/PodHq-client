import type { WeeklyRecommendation } from "@/lib/coach/weekly-recommendation";

export function WeeklyRecommendationCard({ recommendation }: { recommendation: WeeklyRecommendation }) {
  return (
    <div className="card-light p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">This week&apos;s focus</p>
      <p className="mt-1 text-base font-semibold">{recommendation.habit}</p>
      <p className="mt-1 text-sm text-card-light-muted">{recommendation.reason}</p>
    </div>
  );
}
