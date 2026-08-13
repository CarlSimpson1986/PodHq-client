import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

interface SendPushInput {
  memberId: number;
  title: string;
  body: string;
  url: string;
}

interface SendPushResult {
  ok: boolean;
  sentCount: number;
  errorDetail?: string;
}

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Sends a push notification to every device a member has subscribed on
 * (push_subscriptions can hold more than one per member). Never throws —
 * same shape as src/lib/notifications/resend.ts, so callers can always log
 * the real outcome via notifyFireAndForget rather than an unhandled
 * rejection silently skipping it. A member with zero subscriptions (never
 * granted permission) is not an error — sentCount is just 0.
 *
 * A dead/expired subscription (Resend equivalent: a hard bounce) returns
 * 404/410 from the push service — those rows are deleted here so they
 * don't keep getting retried forever.
 */
export async function sendPush({ memberId, title, body, url }: SendPushInput): Promise<SendPushResult> {
  if (!ensureConfigured()) {
    return { ok: false, sentCount: 0, errorDetail: "VAPID keys not configured" };
  }

  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", memberId);

  if (error) {
    return { ok: false, sentCount: 0, errorDetail: error.message };
  }
  if (!subscriptions || subscriptions.length === 0) {
    return { ok: true, sentCount: 0 };
  }

  const payload = JSON.stringify({ title, body, url });
  let sentCount = 0;
  let lastError: string | undefined;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        payload
      );
      sentCount += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        lastError = err instanceof Error ? err.message : "Unknown push error";
        console.error("[push] failed to send", { memberId, subscriptionId: sub.id, error: lastError });
      }
    }
  }

  return { ok: sentCount > 0 || subscriptions.length === 0, sentCount, errorDetail: lastError };
}
