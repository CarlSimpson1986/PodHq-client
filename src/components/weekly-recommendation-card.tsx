import type { WeeklyRecommendation } from "@/lib/coach/weekly-recommendation";

export function WeeklyRecommendationCard({ recommendation }: { recommendation: WeeklyRecommendation }) {
  return (
    <div className="card-glass p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">This week&apos;s focus</p>
      <p className="mt-1 text-base font-semibold text-foreground">{recommendation.habit}</p>
      <p className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</p>
    </div>
  );
}
