"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CheckInState {
  kind: "no_profile" | "not_due" | "due" | "overdue";
  daysRemaining?: number;
  nextDueDate?: string;
  daysOverdue?: number;
}

interface WearableReflectionItem {
  metric: "sleep" | "resting_hr";
  direction: "up" | "down";
  text: string;
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
  totalSteps: number | null;
  avgRestingHeartRate: number | null;
  avgSleepMinutes: number | null;
}

const buttonClass =
  "w-full rounded-lg bg-card-light-foreground px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50";

// Same selected/unselected button convention as coach-onboarding-form.tsx's
// optionClass — kept local rather than shared since the two forms don't
// otherwise share a component.
const optionClass = (selected: boolean) =>
  `flex-1 rounded-lg border px-2 py-3 text-center text-sm font-medium ${
    selected
      ? "border-card-light-foreground bg-card-light-foreground text-white"
      : "border-card-light-border text-card-light-foreground hover:bg-card-border/10"
  }`;

const textAreaClass =
  "w-full rounded-lg border border-card-light-border bg-white px-4 py-3 text-sm text-card-light-foreground focus:border-card-light-foreground focus:outline-none";

const WEEK_FEEL_OPTIONS = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Tough" },
  { value: 3, label: "OK" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatSleep(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function ReviewStats({ review }: { review: WeeklyReview }) {
  return (
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
        {review.totalSteps !== null && (
          <div className="rounded-xl border border-card-light-border p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Steps</p>
            <p className="mt-1 text-lg font-semibold">{review.totalSteps.toLocaleString("en-GB")}</p>
          </div>
        )}
        {review.avgRestingHeartRate !== null && (
          <div className="rounded-xl border border-card-light-border p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Avg resting HR</p>
            <p className="mt-1 text-lg font-semibold">{review.avgRestingHeartRate}bpm</p>
          </div>
        )}
        {review.avgSleepMinutes !== null && (
          <div className="rounded-xl border border-card-light-border p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Avg sleep</p>
            <p className="mt-1 text-lg font-semibold">{formatSleep(review.avgSleepMinutes)}</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-card-light-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Nutrition</p>
        {review.nutritionDaysLogged === 0 ? (
          <p className="mt-1 text-sm text-card-light-muted">No meals logged this week.</p>
        ) : (
          <p className="mt-1 text-sm">
            Logged {review.nutritionDaysLogged}/{review.nutritionDaysInWindow} days — averaging {review.avgDailyCalories}{" "}
            kcal
            {review.targets ? ` (target ${review.targets.calories})` : ""} and {review.avgDailyProteinG}g protein
            {review.targets ? ` (target ${review.targets.proteinG}g)` : ""} on days logged.
          </p>
        )}
      </div>
    </div>
  );
}

export function CheckInView() {
  const router = useRouter();
  const [state, setState] = useState<CheckInState | null>(null);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [wearableReflection, setWearableReflection] = useState<WearableReflectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Ceremonial "reviewing your data" beat before revealing the due/overdue
  // check-in — the data's already back from the fetch below by the time
  // this clears, this is deliberately a held beat, not a real wait.
  const [reviewing, setReviewing] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [weekFeel, setWeekFeel] = useState<number | null>(null);
  const [hadPain, setHadPain] = useState<boolean | null>(null);
  const [painDetail, setPainDetail] = useState("");
  const [barriers, setBarriers] = useState("");
  const [habit, setHabit] = useState("");

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const res = await fetch("/api/member/checkin");
        const body = await res.json();
        if (body.status === "ok") {
          setState(body.state);
          setReview(body.review);
          setNarrative(body.narrative ?? null);
          setWearableReflection(body.wearableReflection ?? []);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (loading || !state || (state.kind !== "due" && state.kind !== "overdue")) return;
    const timer = setTimeout(() => setReviewing(false), 1600);
    return () => clearTimeout(timer);
  }, [loading, state]);

  async function handleComplete() {
    if (weekFeel === null || hadPain === null || habit.trim().length === 0) return;
    setCompleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/member/checkin/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekFeel,
          hadPain,
          painDetail: hadPain ? painDetail.trim() || undefined : undefined,
          barriers: barriers.trim() || undefined,
          habit: habit.trim(),
        }),
      });
      const body = await res.json();
      if (body.status === "ok") {
        setCompleted(true);
        router.refresh();
      } else {
        setErrorMessage(body.message ?? "Couldn't save that. Try again.");
      }
    } catch {
      setErrorMessage("Couldn't save that. Try again.");
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

  if (state.kind === "not_due") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-card-light-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Next check-in</p>
          <p className="mt-1 text-lg font-semibold">
            {state.daysRemaining} {state.daysRemaining === 1 ? "day" : "days"} to go
          </p>
          <p className="mt-1 text-sm text-card-light-muted">Due {state.nextDueDate} — a week&apos;s review, ready every Sunday.</p>
        </div>
        {review && <ReviewStats review={review} />}
      </div>
    );
  }

  // due / overdue — the actual check-in ritual.
  if (reviewing) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-card-light-border border-t-card-light-foreground" />
        <p className="text-sm font-medium text-card-light-muted">Reviewing your data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-card-light-border p-5">
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

      {review && <ReviewStats review={review} />}

      {wearableReflection.length > 0 && (
        <div className="space-y-3">
          {wearableReflection.map((item) => (
            <div key={item.metric} className="rounded-xl border border-card-light-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">
                {item.metric === "sleep" ? "Sleep" : "Resting heart rate"}
              </p>
              <p className="mt-1 text-sm">{item.text}</p>
            </div>
          ))}
        </div>
      )}

      {narrative && (
        <div className="rounded-xl bg-card-light-foreground p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Your coach&apos;s review</p>
          <p className="mt-2 text-sm leading-relaxed text-white">{narrative}</p>
        </div>
      )}

      {!completed && (
        <div className="space-y-5 border-t border-card-light-border pt-5">
          <div>
            <p className="text-sm font-semibold">How did this week feel overall?</p>
            <div className="mt-2 flex gap-2">
              {WEEK_FEEL_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setWeekFeel(o.value)} className={optionClass(weekFeel === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Any pain or discomfort that lingered beyond a normal workout?</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setHadPain(false)} className={optionClass(hadPain === false)}>
                No
              </button>
              <button type="button" onClick={() => setHadPain(true)} className={optionClass(hadPain === true)}>
                Yes
              </button>
            </div>
            {hadPain === true && (
              <textarea
                value={painDetail}
                onChange={(e) => setPainDetail(e.target.value)}
                placeholder="What, and where?"
                rows={2}
                className={`${textAreaClass} mt-2`}
              />
            )}
          </div>

          <div>
            <p className="text-sm font-semibold">Anything that got in the way this week? <span className="font-normal text-card-light-muted">(optional)</span></p>
            <textarea
              value={barriers}
              onChange={(e) => setBarriers(e.target.value)}
              placeholder="Missed sessions, travel, motivation..."
              rows={2}
              className={`${textAreaClass} mt-2`}
            />
          </div>

          <div>
            <p className="text-sm font-semibold">What&apos;s one habit that&apos;s going to push you forwards this week?</p>
            <p className="mt-1 text-xs text-card-light-muted">This becomes your coach&apos;s focus for the week ahead.</p>
            <textarea
              value={habit}
              onChange={(e) => setHabit(e.target.value)}
              placeholder="e.g. Lights out by 10:30pm on weeknights"
              rows={2}
              className={`${textAreaClass} mt-2`}
            />
          </div>

          {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

          <button
            type="button"
            onClick={handleComplete}
            disabled={completing || weekFeel === null || hadPain === null || habit.trim().length === 0}
            className={buttonClass}
          >
            {completing ? "Saving..." : "Mark check-in complete"}
          </button>
        </div>
      )}
      {completed && <p className="text-center text-sm text-success">Check-in complete. See you next Sunday.</p>}
    </div>
  );
}
