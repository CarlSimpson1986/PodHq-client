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

function formatMinutesSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// Circuit result line — one per format, each mirroring the exact
// phrasing that format's own summary screen uses in workout-view.tsx.
// AMRAP/RFT never log per-set actuals (no rep-counting sensors, no
// per-set completion the way straight sets has), so this stands in for
// the RPE/weight list below. HIIT (2026-08-30) always completes every
// prescribed round in v1 (no DNF), so its line is simpler than RFT's own
// capped-vs-normal branch — there's only ever one outcome.
function circuitResultLine(session: LastSessionDetail): string {
  if (session.format === "amrap") {
    const minutes = Math.round((session.timeCapSeconds ?? 0) / 60);
    const rounds = session.roundsCompleted ?? 0;
    return `AMRAP — ${minutes} min: ${rounds} round${rounds === 1 ? "" : "s"}`;
  }
  if (session.format === "hiit") {
    const rounds = session.targetRounds ?? session.roundsCompleted ?? 0;
    return `HIIT — ${rounds} round${rounds === 1 ? "" : "s"} in ${formatMinutesSeconds(session.elapsedSeconds ?? 0)}`;
  }
  const capped = session.elapsedSeconds !== null && session.timeCapSeconds !== null && session.elapsedSeconds >= session.timeCapSeconds;
  const time = formatMinutesSeconds(session.elapsedSeconds ?? 0);
  return capped
    ? `Rounds For Time — time cap reached: ${session.roundsCompleted ?? 0} round${session.roundsCompleted === 1 ? "" : "s"} in ${time}`
    : `Rounds For Time — ${session.targetRounds ?? session.roundsCompleted ?? 0} rounds in ${time}`;
}

// Shared read-only rendering for a single completed session (2026-08-30)
// — extracted out of what used to be LastSessionCard's own JSX so the
// same format-branching logic serves both the "Last session" card on
// /training and the session-history detail page
// (/training/history/[sessionId]) with one fix living in one place, not
// two copies drifting apart. No data-fetching of its own — both call
// sites already have a LastSessionDetail loaded before rendering this.
export function SessionDetailView({ session }: { session: LastSessionDetail }) {
  // AMRAP/RFT/HIIT — a genuinely different shape from straight sets: no
  // per-set RPE to show, so the round's result line (circuitResultLine
  // above) stands in for it. Per exercise, actuals are preferred over
  // the prescription whenever something was actually logged — HIIT's
  // optional post-workout reps tally (log-hiit-reps) writes into
  // repsActual, same column every other format already uses, so this is
  // the one place that needed to start reading it (2026-08-30 fix — it
  // was being fetched all along and simply never rendered here).
  if (session.format !== "straight_sets") {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold">{formatDate(session.createdAt)}</p>
        <p className="text-sm font-semibold text-card-light-foreground">{circuitResultLine(session)}</p>
        <div className="space-y-2">
          {session.exercises.map((exercise, i) => {
            const set = exercise.sets[0];
            const reps = set?.repsActual ?? set?.repsTarget;
            const weight = set?.weightActualKg ?? set?.weightTargetKg;
            return (
              <div key={exercise.exerciseKey} className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  {i + 1}. {exercise.name}
                </p>
                <p className="text-xs text-card-light-muted">
                  {reps ?? "—"} reps
                  {weight ? ` @ ${weight}kg` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
