"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CheckInState {
  kind: "no_profile" | "not_due" | "due" | "overdue";
  daysRemaining?: number;
  nextDueDate?: string;
  daysOverdue?: number;
}

interface WeeklyReview {
  periodStart: string;
  periodEnd: string;
  sessionsCompleted: number;
  totalVolumeKg: number;
  nutritionDaysLogged: number;
  nutritionDaysInWindow: number;
  avgDailyCalories: number | null;
  avgDailyProteinG: number | null;
  targets: { calories: number; proteinG: number } | null;
}

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function CheckInView() {
  const router = useRouter();
  const [state, setState] = useState<CheckInState | null>(null);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const res = await fetch("/api/member/checkin");
        const body = await res.json();
        if (body.status === "ok") {
          setState(body.state);
          setReview(body.review);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch("/api/member/checkin/complete", { method: "POST" });
      const body = await res.json();
      if (body.status === "ok") {
        setCompleted(true);
        router.refresh();
      }
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return <p className="text-center text-sm text-card-light-muted">Loading...</p>;
  }

  if (!state || state.kind === "no_profile") {
    return <p className="text-sm text-card-light-muted">Set up your AI Coach first to unlock weekly check-ins.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-card-light-border p-5">
        {state.kind === "not_due" && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Next check-in</p>
            <p className="mt-1 text-lg font-semibold">
              {state.daysRemaining} {state.daysRemaining === 1 ? "day" : "days"} to go
            </p>
            <p className="mt-1 text-sm text-card-light-muted">Due {state.nextDueDate} — a week&apos;s review, ready every Sunday.</p>
          </>
        )}
        {state.kind === "due" && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">Check-in ready</p>
            <p className="mt-1 text-sm text-card-light-muted">Here&apos;s how your week went.</p>
          </>
        )}
        {state.kind === "overdue" && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-danger">
              Overdue by {state.daysOverdue} {state.daysOverdue === 1 ? "day" : "days"}
            </p>
            <p className="mt-1 text-sm text-card-light-muted">Still here — here&apos;s how your week went.</p>
          </>
        )}
      </div>

      {review && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
            {formatDateRange(review.periodStart, review.periodEnd)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-card-light-border p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Sessions</p>
              <p className="mt-1 text-lg font-semibold">{review.sessionsCompleted}</p>
            </div>
            <div className="rounded-xl border border-card-light-border p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Volume</p>
              <p className="mt-1 text-lg font-semibold">{Math.round(review.totalVolumeKg)}kg</p>
            </div>
          </div>

          <div className="rounded-xl border border-card-light-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Nutrition</p>
            {review.nutritionDaysLogged === 0 ? (
              <p className="mt-1 text-sm text-card-light-muted">No meals logged this week.</p>
            ) : (
              <p className="mt-1 text-sm">
                Logged {review.nutritionDaysLogged}/{review.nutritionDaysInWindow} days — averaging{" "}
                {review.avgDailyCalories} kcal
                {review.targets ? ` (target ${review.targets.calories})` : ""} and {review.avgDailyProteinG}g protein
                {review.targets ? ` (target ${review.targets.proteinG}g)` : ""} on days logged.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-dashed border-card-light-border p-5 opacity-70">
        <p className="text-sm font-semibold">Reflection questions</p>
        <p className="mt-1 text-sm text-card-light-muted">Coming soon — for now, here&apos;s what your week looked like.</p>
      </div>

      {(state.kind === "due" || state.kind === "overdue") && !completed && (
        <button type="button" onClick={handleComplete} disabled={completing} className={buttonClass}>
          {completing ? "Saving..." : "Mark check-in complete"}
        </button>
      )}
      {completed && <p className="text-center text-sm text-success">Check-in complete. See you next Sunday.</p>}
    </div>
  );
}
