export function MemberHabitCard({ habit, streakWeeks }: { habit: string | null; streakWeeks: number }) {
  return (
    <div className="card-light p-5">
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
    </div>
  );
}
