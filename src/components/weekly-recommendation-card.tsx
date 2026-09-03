import type { WeeklyRecommendation } from "@/lib/coach/weekly-recommendation";
import { SparkleIcon } from "@/components/icons";

export function WeeklyRecommendationCard({ recommendation }: { recommendation: WeeklyRecommendation }) {
  return (
    <div className="card-light flex flex-col items-center p-5 text-center">
      <SparkleIcon className="h-6 w-6 text-card-light-foreground" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">This week&apos;s focus</p>
      <p className="mt-1 text-base font-semibold">{recommendation.habit}</p>
      <p className="mt-1 text-sm text-card-light-muted">{recommendation.reason}</p>
    </div>
  );
}
