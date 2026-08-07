import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SOFT_LOCK_WINDOW_MINUTES = 15;
const SOFT_LOCK_THRESHOLD = 5;
const HARD_LOCK_THRESHOLD = 10;

const LOGIN_IP_WINDOW_MINUTES = 15;
const LOGIN_IP_LIMIT = 20;

export type LockoutState =
  | { locked: false }
  | { locked: true; reason: "too_many_recent_attempts" | "account_locked" };

/**
 * Same soft/hard lockout model as podHq's checkLoginLockout, minus the
 * MFA/magic-link variants this app doesn't have. No admin_lockout_reset
 * event here — this app has no admin UI, so a hard lock (10 failures since
 * last success) currently has no self-service recovery path; clearing one
 * means deleting the account's login_failure rows from auth_events
 * directly until Stage 5 (real onboarding) adds account recovery.
 */
export async function checkLoginLockout(email: string, ip?: string | null): Promise<LockoutState> {
  const admin = createAdminClient();

  const since = new Date(Date.now() - SOFT_LOCK_WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentFailures } = await admin
    .from("auth_events")
    .select("*", { count: "exact", head: true })
    .eq("user_email", email)
    .eq("event_type", "login_failure")
    .gte("created_at", since);

  if ((recentFailures ?? 0) >= SOFT_LOCK_THRESHOLD) {
    return { locked: true, reason: "too_many_recent_attempts" };
  }

  // Per-account thresholds alone can't stop one source spraying many
  // different accounts a few guesses each.
  if (ip) {
    const { count: ipFailures } = await admin
      .from("auth_events")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("event_type", "login_failure")
      .gte("created_at", new Date(Date.now() - LOGIN_IP_WINDOW_MINUTES * 60_000).toISOString());

    if ((ipFailures ?? 0) >= LOGIN_IP_LIMIT) {
      return { locked: true, reason: "too_many_recent_attempts" };
    }
  }

  const { data: lastSuccessRows } = await admin
    .from("auth_events")
    .select("created_at")
    .eq("user_email", email)
    .eq("event_type", "login_success")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastSuccessAt = lastSuccessRows?.[0]?.created_at;

  let failuresSinceSuccess = admin
    .from("auth_events")
    .select("*", { count: "exact", head: true })
    .eq("user_email", email)
    .eq("event_type", "login_failure");

  if (lastSuccessAt) {
    failuresSinceSuccess = failuresSinceSuccess.gt("created_at", lastSuccessAt);
  }

  const { count: totalFailures } = await failuresSinceSuccess;

  if ((totalFailures ?? 0) >= HARD_LOCK_THRESHOLD) {
    return { locked: true, reason: "account_locked" };
  }

  return { locked: false };
}
