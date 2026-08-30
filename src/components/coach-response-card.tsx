import Link from "next/link";

// Home dashboard, 2026-08-30 — the check-in's actual feedback (the
// personalised "your coach says" response, plus a pain acknowledgment
// where relevant) used to be shown once on the check-in completion
// screen and nowhere else — asked directly whether that should be
// actionable on the main dashboard rather than lost the moment a member
// navigates away. Same tappable-card-to-/coach/checkin convention as
// MemberHabitCard right next to it; self-expiring the same way
// (getLatestCheckInResponse always reads the LATEST check-in, so this
// updates on its own each week with nothing to manually clear).
export function CoachResponseCard({
  response,
}: {
  response: { narrative: string | null; painAcknowledgment: string | null } | null;
}) {
  const hasContent = response?.narrative || response?.painAcknowledgment;

  if (!hasContent) {
    return (
      <Link href="/coach/checkin" prefetch={false} className="card-light block p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Your coach</p>
        <p className="mt-1 text-sm text-card-light-muted">Complete your first weekly check-in to hear from your coach here.</p>
      </Link>
    );
  }

  return (
    <Link href="/coach/checkin" prefetch={false} className="card-light block space-y-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Your coach</p>
      {response!.narrative && <p className="text-sm leading-relaxed">{response!.narrative}</p>}
      {response!.painAcknowledgment && <p className="text-sm text-warning">{response!.painAcknowledgment}</p>}
    </Link>
  );
}
