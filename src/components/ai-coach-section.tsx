import Link from "next/link";
import type { CoachHomeState } from "@/lib/coach/trial-state";
import { TrialBanner } from "@/components/trial-banner";
import { DumbbellIcon } from "@/components/icons";

// Renders the home screen's AI Coach area per the state derived by
// getCoachHomeState(). Stage 3/4 (workout generation, RPE, session data)
// aren't built yet — trial_active and subscriber deliberately don't show
// fabricated stats (streaks, PBs) here, just accurate status and the next
// real action (book a session). See ROADMAP.md's "Hove AI Coach trial
// beta" entry.
export function AICoachSection({ state }: { state: CoachHomeState }) {
  switch (state.kind) {
    case "no_trial":
      return <TrialBanner />;

    case "trial_pending":
      return (
        <div className="rounded-xl border border-card-light-border p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <DumbbellIcon className="h-4 w-4" />
            AI Coach trial ready
          </p>
          <p className="mt-1 text-sm text-card-light-muted">
            Book your next session and your 7-day trial starts automatically.
          </p>
        </div>
      );

    case "trial_active":
      return (
        <div className="rounded-xl border border-card-light-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            AI Coach · Trial · {state.daysRemaining} {state.daysRemaining === 1 ? "day" : "days"} remaining
          </p>
          <p className="mt-2 text-sm text-card-light-muted">
            Your personalised workout is ready when you book your next session.
          </p>
          <Link
            href="/buy-membership"
            className="mt-3 inline-block text-sm font-semibold text-card-light-foreground underline"
          >
            Keep your coach after the trial
          </Link>
        </div>
      );

    case "trial_expired":
      return (
        <div className="rounded-xl border border-card-light-border bg-card-light-border/20 p-5 opacity-60">
          <p className="text-sm font-semibold">No session plan waiting for you today.</p>
          <p className="mt-1 text-sm text-card-light-muted">
            Without your coach, your plan is yours to figure out. Upgrade and it&apos;ll be waiting every time.
          </p>
          <Link
            href="/buy-membership"
            className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Upgrade
          </Link>
        </div>
      );

    case "subscriber":
      return (
        <div className="rounded-xl border border-card-light-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">{state.tierName} member</p>
          <p className="mt-2 text-sm text-card-light-muted">
            Your AI Coach is ready — book a session to get your next personalised workout.
          </p>
        </div>
      );
  }
}
