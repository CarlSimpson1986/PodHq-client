import { redirect } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getSessionHistory, getLifetimeWorkoutStats, type SessionHistoryEntry, type WorkoutFormat } from "@/lib/coach/workout-session";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";

const FORMAT_LABEL: Record<WorkoutFormat, string> = {
  straight_sets: "Straight Sets",
  amrap: "AMRAP",
  rounds_for_time: "Rounds For Time",
  hiit: "HIIT",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatMinutesSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// One-line headline stat per list row — volume for straight sets (the
// only format that logs real per-set weight/reps), rounds+time for the
// three circuit formats (same fields their own summary screens show).
function headlineStat(entry: SessionHistoryEntry): string {
  if (entry.format === "straight_sets") return `${Math.round(entry.totalVolumeKg)}kg volume`;
  const rounds = entry.roundsCompleted ?? entry.targetRounds ?? 0;
  return `${rounds} round${rounds === 1 ? "" : "s"} in ${formatMinutesSeconds(entry.elapsedSeconds ?? 0)}`;
}

// Session history (2026-08-30) — a browsable list of past completed
// sessions, linked from the "Last session" card on /training. Stats
// summary at the top covers the last 26 weeks (getLifetimeWorkoutStats
// — see its own comment for why not unbounded); the list below is
// capped at the last 20, no pagination this stage.
export default async function TrainingHistoryPage() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  if (!(await hasPremium(member))) {
    redirect("/dashboard");
  }

  const [history, stats] = await Promise.all([getSessionHistory(member.id), getLifetimeWorkoutStats(member.id)]);

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="History" subtitle="Your past sessions" />
      <div className="flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <Link href="/training" prefetch={false} className="text-xs font-medium text-muted-foreground underline">
            ← Back to Training
          </Link>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 6 months</p>
            <div className="card-light space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-card-light-muted">Sessions completed</p>
                <p className="text-sm font-semibold">{stats.totalSessions}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-card-light-muted">Total volume</p>
                <p className="text-sm font-semibold">{Math.round(stats.totalVolumeKg)}kg</p>
              </div>
              {stats.totalSessions > 0 && (
                <p className="text-xs text-card-light-muted">
                  {(Object.entries(stats.byFormat) as [WorkoutFormat, number][])
                    .filter(([, count]) => count > 0)
                    .map(([format, count]) => `${count} ${FORMAT_LABEL[format]}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</p>
            {history.length === 0 ? (
              <div className="card-light p-5">
                <p className="text-sm text-card-light-muted">No completed sessions yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <Link key={entry.sessionId} href={`/training/history/${entry.sessionId}`} prefetch={false} className="card-light block p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{formatDate(entry.createdAt)}</p>
                        <p className="text-xs text-card-light-muted">{FORMAT_LABEL[entry.format]}</p>
                      </div>
                      <p className="text-sm text-card-light-muted">{headlineStat(entry)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
