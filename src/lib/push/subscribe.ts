"use client";

/**
 * Requests notification permission and subscribes this device to push,
 * POSTing the subscription to /api/push/subscribe for storage. Called from
 * the /bookings page — a natural moment (already engaged enough to be
 * checking bookings), not forced at signup. Returns false (never throws)
 * on any failure — permission denied, no service worker support, VAPID
 * key missing, etc. — so the caller can just skip showing "subscribed"
 * state rather than needing its own try/catch.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const vapidPublicKeyRes = await fetch("/api/push/vapid-public-key");
    const { publicKey } = await vapidPublicKeyRes.json();
    if (!publicKey) return false;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
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
    return body.status === "ok";
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0))).buffer as ArrayBuffer;
}
