import "server-only";
import webpush from "web-push";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
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

// The native Android app (Capacitor server.url mode, plain system WebView —
// see native-subscribe.ts) doesn't reliably receive background browser Web
// Push, so it registers a real FCM token instead of a push_subscriptions
// row. Sent to separately here via the Firebase Admin SDK, alongside (not
// instead of) the web-push loop below, since real browser/PWA visitors
// still use push_subscriptions. FIREBASE_SERVICE_ACCOUNT_JSON is the
// service account key JSON (Firebase console → Project settings → Service
// accounts → Generate new private key), stored as a raw JSON string env
// var — never committed, same convention as every other secret here.
let firebaseConfigured = false;

function ensureFirebaseConfigured(): boolean {
  if (firebaseConfigured) return true;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) return false;

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }
  firebaseConfigured = true;
  return true;
}

interface SendLegResult {
  sentCount: number;
  attemptedCount: number;
  lastError?: string;
}

async function sendWebPush(
  admin: ReturnType<typeof createAdminClient>,
  memberId: number,
  payload: string
): Promise<SendLegResult> {
  if (!ensureConfigured()) return { sentCount: 0, attemptedCount: 0, lastError: "VAPID keys not configured" };

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", memberId);
  if (error) return { sentCount: 0, attemptedCount: 0, lastError: error.message };
  if (!subscriptions || subscriptions.length === 0) return { sentCount: 0, attemptedCount: 0 };

  let sentCount = 0;
  let lastError: string | undefined;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
        payload
      );
      sentCount += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        lastError = err instanceof Error ? err.message : "Unknown push error";
        console.error("[push] failed to send (web)", { memberId, subscriptionId: sub.id, error: lastError });
      }
    }
  }
  return { sentCount, attemptedCount: subscriptions.length, lastError };
}

async function sendNativePush(
  admin: ReturnType<typeof createAdminClient>,
  memberId: number,
  title: string,
  body: string,
  url: string
): Promise<SendLegResult> {
  if (!ensureFirebaseConfigured()) return { sentCount: 0, attemptedCount: 0, lastError: "Firebase not configured" };

  const { data: tokens, error } = await admin
    .from("push_device_tokens")
    .select("id, fcm_token")
    .eq("member_id", memberId);
  if (error) return { sentCount: 0, attemptedCount: 0, lastError: error.message };
  if (!tokens || tokens.length === 0) return { sentCount: 0, attemptedCount: 0 };

  let sentCount = 0;
  let lastError: string | undefined;
  for (const device of tokens) {
    try {
      await getMessaging().send({
        token: device.fcm_token as string,
        notification: { title, body },
        data: { url },
      });
      sentCount += 1;
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Same "dead endpoint, stop retrying" cleanup as the 404/410 web-push
      // branch above, FCM's equivalent error codes.
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        await admin.from("push_device_tokens").delete().eq("id", device.id);
      } else {
        lastError = err instanceof Error ? err.message : "Unknown FCM error";
        console.error("[push] failed to send (native)", { memberId, deviceId: device.id, error: lastError });
      }
    }
  }
  return { sentCount, attemptedCount: tokens.length, lastError };
}

/**
 * Sends a push notification to every device a member has subscribed on —
 * browser Web Push (push_subscriptions) and native FCM (push_device_tokens)
 * alike, a member can hold rows in both. Never throws — same shape as
 * src/lib/notifications/resend.ts, so callers can always log the real
 * outcome via notifyFireAndForget rather than an unhandled rejection
 * silently skipping it. A member with zero subscriptions/tokens (never
 * granted permission) is not an error — sentCount is just 0.
 */
export async function sendPush({ memberId, title, body, url }: SendPushInput): Promise<SendPushResult> {
  const admin = createAdminClient();
  const payload = JSON.stringify({ title, body, url });

  const [web, native] = await Promise.all([
    sendWebPush(admin, memberId, payload),
    sendNativePush(admin, memberId, title, body, url),
  ]);

  const sentCount = web.sentCount + native.sentCount;
  const attemptedCount = web.attemptedCount + native.attemptedCount;
  const errorDetail = [web.lastError, native.lastError].filter(Boolean).join("; ") || undefined;
  return { ok: sentCount > 0 || attemptedCount === 0, sentCount, errorDetail };
}
