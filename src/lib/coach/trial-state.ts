import type { Member, Membership } from "@/lib/data/member";

// Presentation-only derivation of the home screen's AI Coach state — no DB
// access here, just the member/membership rows the home page already
// fetches. Five states, not the brief's four: "trial_pending" (tapped
// Start but hasn't finished onboarding yet, so the clock hasn't started —
// see the hook in api/member/coach-profile/route.ts) is a real state a
// member can sit in if they abandon onboarding partway, and showing them
// the initial trial pitch again there would be wrong since they already
// said yes.
export type CoachHomeState =
  | { kind: "no_trial" }
  | { kind: "trial_pending" }
  | { kind: "trial_active"; daysRemaining: number }
  | { kind: "trial_expired" }
  | { kind: "subscriber"; tierName: string };

export function getCoachHomeState(member: Member, membership: Membership | null): CoachHomeState {
  if (membership) {
    return { kind: "subscriber", tierName: membership.tier_name };
  }

  if (member.trial_expires_at && new Date(member.trial_expires_at) > new Date()) {
    const msRemaining = new Date(member.trial_expires_at).getTime() - Date.now();
    const daysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
    return { kind: "trial_active", daysRemaining };
  }

  // trial_started_at set but no longer active (checked above) means it ran
  // its course and expired, not that it's still pending.
  if (member.trial_started_at) {
    return { kind: "trial_expired" };
  }

  if (member.trial_activated_at) {
    return { kind: "trial_pending" };
  }

  return { kind: "no_trial" };
}
