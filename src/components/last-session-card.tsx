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
  if (rpe === 3) return "bg-accent/15 text-accent";
  return "bg-warning/15 text-warning";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

export function LastSessionCard({ session }: { session: LastSessionDetail | null }) {
  if (!session || session.exercises.length === 0) {
    return (
      <div className="card-glass p-5">
        <p className="text-sm text-muted-foreground">Complete a session to see it here.</p>
      </div>
    );
  }

  return (
    <div className="card-glass space-y-4 p-5">
      <p className="text-sm font-semibold text-foreground">{formatDate(session.createdAt)}</p>
      <div className="space-y-3">
        {session.exercises.map((exercise) => {
          const ratedSets = exercise.sets.filter((s) => s.rpe !== null);
          const topWeight = Math.max(0, ...exercise.sets.map((s) => s.weightActualKg ?? 0));
          return (
            <div key={exercise.exerciseKey} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">{exercise.name}</p>
                {topWeight > 0 && <p className="text-xs text-muted-foreground">{topWeight}kg</p>}
              </div>
              <div className="flex gap-1">
                {ratedSets.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Not rated</span>
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
