import Link from "next/link";
import type { LastSessionDetail } from "@/lib/coach/exercise-performance";
import { SessionDetailView } from "@/components/session-detail-view";

// Thin wrapper (2026-08-30) — the actual format-branching rendering
// moved to session-detail-view.tsx, shared with the new session-history
// detail page. This component now only owns the "Last session" framing
// and the link into the full history.
export function LastSessionCard({ session }: { session: LastSessionDetail | null }) {
  if (!session || session.exercises.length === 0) {
    return (
      <div className="card-light p-5">
        <p className="text-sm text-card-light-muted">Complete a session to see it here.</p>
      </div>
    );
  }

  return (
    <div className="card-light space-y-4 p-5">
      <SessionDetailView session={session} />
      <Link href="/training/history" prefetch={false} className="block text-xs font-medium text-card-light-muted underline">
        View full history →
      </Link>
    </div>
  );
}
