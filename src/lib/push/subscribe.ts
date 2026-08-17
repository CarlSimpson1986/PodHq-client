"use client";

export type SubscribeResult = { ok: true } | { ok: false; reason: string };

/**
 * Requests notification permission and subscribes this device to push,
 * POSTing the subscription to /api/push/subscribe for storage. Called from
 * the /bookings page — a natural moment (already engaged enough to be
 * checking bookings), not forced at signup. Never throws — returns a typed
 * failure reason instead (permission denied, no service worker support,
 * VAPID key missing, etc.) so the caller can surface something specific
 * rather than a generic "didn't work" with no way to debug it on a device
 * that isn't attached to a devtools console.
 */
export async function subscribeToPush(): Promise<SubscribeResult> {
  if (typeof window === "undefined") return { ok: false, reason: "No window (SSR)." };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "This browser doesn't support push notifications." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: `Permission ${permission}.` };

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const vapidPublicKeyRes = await fetch("/api/push/vapid-public-key");
    const vapidBody = await vapidPublicKeyRes.json();
    if (!vapidBody.publicKey) {
      return { ok: false, reason: `No VAPID public key (${vapidPublicKeyRes.status}: ${vapidBody.message ?? "unknown"}).` };
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidBody.publicKey),
    });

    const json = subscription.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    });
    const body = await res.json();
    if (body.status !== "ok") {
      return { ok: false, reason: `Save failed (${res.status}: ${body.message ?? "unknown"}).` };
    }
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error.";
    console.error("[push] subscribe failed", err);
    return { ok: false, reason };
  }
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0))).buffer as ArrayBuffer;
}
