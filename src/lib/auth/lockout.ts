import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SOFT_LOCK_WINDOW_MINUTES = 15;
const SOFT_LOCK_THRESHOLD = 5;
const HARD_LOCK_THRESHOLD = 10;

const AUTH_ACTION_WINDOW_MINUTES = 15;
const AUTH_ACTION_PER_EMAIL_LIMIT = 3;
const AUTH_ACTION_PER_IP_LIMIT = 10;

const LOGIN_IP_WINDOW_MINUTES = 15;
const LOGIN_IP_LIMIT = 20;

export type LockoutState =
  | { locked: false }
  | { locked: true; reason: "too_many_recent_attempts" | "account_locked" };

/**
 * Same soft/hard lockout model as podHq's checkLoginLockout, minus the
 * MFA/magic-link variants this app doesn't have. Stage 5 closed the old
 * hard-lock recovery gap: a completed self-service password reset now
 * counts as a reset point for the failure count, same role podHq's
 * admin_lockout_reset event plays there — the difference is this one's
 * member-triggered, not admin-triggered, since this app has no admin UI.
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
    .in("event_type", ["login_success", "password_reset_completed"])
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

/**
 * Per-email and per-IP caps for signup/password-reset requests — these
 * happen before any account/session exists, so the user_id-keyed
 * rate_limits table (which FKs to auth.users) can't be used here. Same
 * auth_events-counting shape as podHq's checkMagicLinkRateLimit.
 */
export async function checkAuthActionRateLimit(
  eventType: "signup" | "password_reset_requested",
  email: string,
  ip: string | null
): Promise<{ allowed: boolean }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - AUTH_ACTION_WINDOW_MINUTES * 60_000).toISOString();

  const { count: emailCount } = await admin
    .from("auth_events")
    .select("*", { count: "exact", head: true })
    .eq("user_email", email)
    .eq("event_type", eventType)
    .gte("created_at", since);

  if ((emailCount ?? 0) >= AUTH_ACTION_PER_EMAIL_LIMIT) {
    return { allowed: false };
  }

  if (ip) {
    const { count: ipCount } = await admin
      .from("auth_events")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("event_type", eventType)
      .gte("created_at", since);

    if ((ipCount ?? 0) >= AUTH_ACTION_PER_IP_LIMIT) {
      return { allowed: false };
    }
  }

  return { allowed: true };
}
