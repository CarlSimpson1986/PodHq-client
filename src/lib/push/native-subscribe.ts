"use client";

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import type { SubscribeResult } from "./subscribe";

// The native Android app runs inside a plain system WebView (Capacitor's
// server.url mode, not Chrome — see capacitor.config.ts), which doesn't
// reliably wake the app for background browser Web Push the way an
// installed Chrome PWA does. subscribeToPush()'s PushManager/service-worker
// path is left in place for actual browser/PWA visitors; this is the
// native-only path, registering a real FCM device token instead, gated
// behind this check so it never runs in the browser.
export function isNativePushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

// Mirrors subscribeToPush()'s contract exactly (same typed result, same
// "never throws" rule) so bookings-view.tsx can call whichever path applies
// without branching on the result shape too.
export async function subscribeToNativePush(): Promise<SubscribeResult> {
  try {
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== "granted") {
      return { ok: false, reason: `Permission ${permStatus.receive}.` };
    }

    const token = await new Promise<string>((resolve, reject) => {
      PushNotifications.addListener("registration", (t) => resolve(t.value));
      PushNotifications.addListener("registrationError", (err) =>
        reject(new Error(err.error || "Registration failed."))
      );
      PushNotifications.register();
    });

    const res = await fetch("/api/push/register-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcmToken: token, platform: "android" }),
    });
    const body = await res.json();
    if (body.status !== "ok") {
      return { ok: false, reason: `Save failed (${res.status}: ${body.message ?? "unknown"}).` };
    }
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown error.";
    console.error("[push] native subscribe failed", err);
    return { ok: false, reason };
  } finally {
    await PushNotifications.removeAllListeners();
  }
}
