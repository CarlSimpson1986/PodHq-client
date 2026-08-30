import type { LastSessionDetail } from "@/lib/coach/exercise-performance";

const RPE_LABEL: Record<number, string> = {
  1: "Effortless",
  2: "Easy",
  3: "Just Right",
  4: "Hard",
  5: "Killer",
};

// Real 1-5 RPE scale (workout_sets.rpe / RPE_SCALE in types.ts) — not the
// 1-10 scale the original design brief assumed. Green for 1-2 (weight
// trends up next time), gold for 3 (holds), amber for 4-5 (holds/trends
// down) — see adjustForRpe in generate-workout.ts for the actual logic
// this mirrors.
function rpeBadgeClass(rpe: number): string {
  if (rpe <= 2) return "bg-success/15 text-success";
  if (rpe === 3) return "bg-card-light-border text-card-light-foreground";
  return "bg-warning/15 text-warning";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

// Circuit result line (2026-08-30) — AMRAP/RFT sessions never log
// per-set actuals (no rep-counting sensors, no per-set completion the
// way straight sets has), so the RPE/weight list below is meaningless
// for them; this is what the card shows instead. Mirrors the phrasing
// each format's own summary screen uses in workout-view.tsx.
function circuitResultLine(session: LastSessionDetail): string {
  if (session.format === "amrap") {
    const minutes = Math.round((session.timeCapSeconds ?? 0) / 60);
    const rounds = session.roundsCompleted ?? 0;
    return `AMRAP — ${minutes} min: ${rounds} round${rounds === 1 ? "" : "s"}`;
  }
  const capped = session.elapsedSeconds !== null && session.timeCapSeconds !== null && session.elapsedSeconds >= session.timeCapSeconds;
  const mins = Math.floor((session.elapsedSeconds ?? 0) / 60);
  const secs = (session.elapsedSeconds ?? 0) % 60;
  const time = `${mins}:${String(secs).padStart(2, "0")}`;
  return capped
    ? `Rounds For Time — time cap reached: ${session.roundsCompleted ?? 0} round${session.roundsCompleted === 1 ? "" : "s"} in ${time}`
    : `Rounds For Time — ${session.targetRounds ?? session.roundsCompleted ?? 0} rounds in ${time}`;
}

export function LastSessionCard({ session }: { session: LastSessionDetail | null }) {
  if (!session || session.exercises.length === 0) {
    return (
      <div className="card-light p-5">
        <p className="text-sm text-card-light-muted">Complete a session to see it here.</p>
      </div>
    );
  }

  // AMRAP/RFT — a genuinely different shape from straight sets: no
  // per-set RPE/weight to show (see circuitResultLine above), so the
  // round's prescription (reps/weight target) stands in for it instead,
  // same fields the workout-taking overview itself shows.
  if (session.format !== "straight_sets") {
    return (
      <div className="card-light space-y-4 p-5">
        <p className="text-sm font-semibold">{formatDate(session.createdAt)}</p>
        <p className="text-sm font-semibold text-card-light-foreground">{circuitResultLine(session)}</p>
        <div className="space-y-2">
          {session.exercises.map((exercise, i) => {
            const set = exercise.sets[0];
            return (
              <div key={exercise.exerciseKey} className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  {i + 1}. {exercise.name}
                </p>
                <p className="text-xs text-card-light-muted">
                  {set?.repsTarget ?? "—"} reps
                  {set?.weightTargetKg ? ` @ ${set.weightTargetKg}kg` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card-light space-y-4 p-5">
      <p className="text-sm font-semibold">{formatDate(session.createdAt)}</p>
      <div className="space-y-3">
        {session.exercises.map((exercise) => {
          const ratedSets = exercise.sets.filter((s) => s.rpe !== null);
          const topWeight = Math.max(0, ...exercise.sets.map((s) => s.weightActualKg ?? 0));
          return (
            <div key={exercise.exerciseKey} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm">{exercise.name}</p>
                {topWeight > 0 && <p className="text-xs text-card-light-muted">{topWeight}kg</p>}
              </div>
              <div className="flex gap-1">
                {ratedSets.length === 0 ? (
                  <span className="text-xs text-card-light-muted">Not rated</span>
                ) : (
                  ratedSets.map((set) => (
                    <span
                      key={set.setNumber}
                      title={RPE_LABEL[set.rpe!]}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rpeBadgeClass(set.rpe!)}`}
                    >
                      RPE {set.rpe}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
