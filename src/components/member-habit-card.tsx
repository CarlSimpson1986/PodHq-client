import Link from "next/link";

// Same card-light styling and destination as the Check-in card right
// below it on /coach — was a plain inert div (2026-08-28 bug: looked
// identically tappable but had no Link/onClick at all, so pressing it
// did nothing). Habit has no separate edit screen of its own; it's set
// as part of the weekly check-in, so that's where tapping this card
// should take a member too.
export function MemberHabitCard({ habit, streakWeeks }: { habit: string | null; streakWeeks: number }) {
  return (
    <Link href="/coach/checkin" prefetch={false} className="card-light block p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Your habit</p>
      {habit === null ? (
        <p className="mt-1 text-sm text-card-light-muted">
          Set one at your next check-in — one habit you&apos;re committing to for the week ahead.
        </p>
      ) : (
        <>
          <p className="mt-1 text-base font-semibold">{habit}</p>
          <p className="mt-1 text-sm text-card-light-muted">
            {streakWeeks > 1 ? `${streakWeeks} weeks running you've set a habit.` : "Set this week — keep it up next check-in to start a streak."}
          </p>
        </>
      )}
    </Link>
  );
}
