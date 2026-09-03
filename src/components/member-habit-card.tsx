import Link from "next/link";
import { CalendarIcon } from "@/components/icons";

// Same card-light styling and destination as the Check-in card right
// below it on /coach — was a plain inert div (2026-08-28 bug: looked
// identically tappable but had no Link/onClick at all, so pressing it
// did nothing). Habit has no separate edit screen of its own; it's set
// as part of the weekly check-in, so that's where tapping this card
// should take a member too.
//
// followThrough (2026-08-30, client-perspective review) — the "did you
// keep last week's habit up?" question was answered every week and only
// ever used once, in that week's own coach response. This rolls it into
// a real stat next to the streak — "3 of your last 5" — real
// accountability, not a line in a paragraph a member may not reread.
export function MemberHabitCard({
  habit,
  streakWeeks,
  followThrough,
}: {
  habit: string | null;
  streakWeeks: number;
  followThrough: { madeProgress: number; total: number } | null;
}) {
  return (
    <Link href="/coach/checkin" prefetch={false} className="card-light flex flex-col items-center p-5 text-center">
      <CalendarIcon className="h-6 w-6 text-card-light-foreground" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Main effort</p>
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
      {followThrough && followThrough.total > 0 && (
        <p className="mt-1 text-xs text-card-light-muted">
          Followed through on {followThrough.madeProgress}/{followThrough.total} recent weeks.
        </p>
      )}
    </Link>
  );
}
