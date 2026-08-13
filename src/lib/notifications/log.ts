import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationEventType } from "./types";

interface LogNotificationInput {
  eventType: NotificationEventType;
  recipientEmail: string;
  memberId?: number;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorDetail?: string;
}

/**
 * Writes to notification_log — same "catch and console.error, never
 * rethrow" shape as logAuthEvent, since a logging failure must never be
 * allowed to become the thing that breaks a booking/purchase response.
 */
export async function logNotification(input: LogNotificationInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notification_log").insert({
    event_type: input.eventType,
    recipient_email: input.recipientEmail,
    member_id: input.memberId ?? null,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
    error_detail: input.errorDetail ?? null,
  });

  if (error) {
    console.error("[notifications] failed to log notification", {
      eventType: input.eventType,
      error: error.message,
    });
  }
}
