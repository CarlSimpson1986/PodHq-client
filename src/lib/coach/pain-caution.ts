import { getInjuryExcludedKeys } from "@/lib/coach/generate-workout";
import type { LatestPainReport } from "@/lib/coach/check-ins";

export type PainCaution =
  | { kind: "none" }
  | { kind: "reported"; painDetail: string | null; flaggedExerciseKeys: string[] };

// Coaching review, 2026-08-30 — the weekly check-in's "any pain or
// discomfort that lingered beyond a normal workout?" question was
// captured (check_ins.answers) and never read by anything again. This
// surfaces the latest report on the very next workout, naming which of
// TODAY's actual exercises touch the reported area — same avoidIfInjury
// keyword match generation's own injury filter already uses
// (getInjuryExcludedKeys), so there's no second, drifting implementation
// of "does this exercise load that body part".
//
// Deliberately advisory, not an automatic exclusion — a one-off
// self-report at a weekly check-in isn't the same weight as a standing,
// deliberate injuries-field update (that stays a separate, explicit
// action in Coach settings, and continues to actually exclude exercises
// from generation). This just makes sure information the member already
// gave the app once actually reaches them again, at the moment it's
// useful — same "member-confirmed suggestion, never a silent autonomous
// change" posture as recovery-signal.ts and block-change-gate.ts.
//
// No location detail (painDetail blank, or no keyword match against
// today's own exercises) still surfaces a caution — just without named
// exercises — rather than silently dropping the report because the text
// didn't happen to match a catalog keyword.
export function getPainCaution(painReport: LatestPainReport | null, sessionExerciseKeys: string[]): PainCaution {
  if (!painReport || !painReport.hadPain) return { kind: "none" };

  const flaggedExerciseKeys = painReport.painDetail
    ? getInjuryExcludedKeys(painReport.painDetail).filter((key) => sessionExerciseKeys.includes(key))
    : [];

  return { kind: "reported", painDetail: painReport.painDetail, flaggedExerciseKeys };
}
