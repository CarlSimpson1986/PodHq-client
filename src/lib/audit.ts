import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthEventType = "login_success" | "login_failure" | "account_locked";

interface LogAuthEventInput {
  email: string;
  userId?: string;
  eventType: AuthEventType;
  ipAddress?: string | null;
  detail?: string;
}

/**
 * Writes to the auth_events audit trail — the same table podHq uses (shared
 * Supabase project, generic schema keyed by email/user_id, not tied to any
 * podHq-specific table). Uses the admin client because auth_events has no
 * RLS policies for regular users — only the service role may write here.
 */
export async function logAuthEvent({
  email,
  userId,
  eventType,
  ipAddress,
  detail,
}: LogAuthEventInput) {
  const admin = createAdminClient();
  const { error } = await admin.from("auth_events").insert({
    user_email: email,
    user_id: userId ?? null,
    event_type: eventType,
    ip_address: ipAddress ?? null,
    detail: detail ?? null,
  });

  if (error) {
    console.error("[audit] failed to log auth event", {
      eventType,
      error: error.message,
    });
  }
}
