import Link from "next/link";
import type { CoachHomeState } from "@/lib/coach/trial-state";
import { TrialBanner } from "@/components/trial-banner";
import { DumbbellIcon } from "@/components/icons";

// Renders the home screen's AI Coach area per the state derived by
// getCoachHomeState(). Stage 5: trial_active/subscriber are now a slim
// status pointer into the dedicated Coach tab (src/app/coach/page.tsx)
// rather than repeating the full set of actions here — Home stays
// booking/credits-focused for every member, the Coach tab is the
// dedicated premium space. no_trial/trial_expired stay full-detail here
// since they're conversion moments that belong where PAYG members
// already are, not behind a tab they may not know to check. See
// ROADMAP.md's "Hove AI Coach trial beta" entry.
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
        <Link href="/dashboard" prefetch={false} className="block rounded-xl border border-card-light-border p-5 hover:bg-card-light-border/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">
            AI Coach · Trial · {state.daysRemaining} {state.daysRemaining === 1 ? "day" : "days"} remaining
          </p>
          <p className="mt-1 text-sm text-card-light-muted">View your coach and today&apos;s workout →</p>
        </Link>
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
        <Link href="/dashboard" prefetch={false} className="block rounded-xl border border-card-light-border p-5 hover:bg-card-light-border/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-success">{state.tierName} member</p>
          <p className="mt-1 text-sm text-card-light-muted">View your coach and today&apos;s workout →</p>
        </Link>
      );
  }
}
