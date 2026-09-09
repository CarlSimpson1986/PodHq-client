"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PushNotifications, type ActionPerformed, type PushNotificationSchema } from "@capacitor/push-notifications";
import { LocalNotifications, type ActionPerformed as LocalActionPerformed } from "@capacitor/local-notifications";
import { isNativePushSupported } from "@/lib/push/native-subscribe";

// FCM only auto-builds a system-tray notification for a *backgrounded* app
// (see AndroidManifest.xml's default_notification_icon comment) — while
// the app is open, "pushNotificationReceived" fires instead with no visual
// effect unless something here does one. Mirrors sw.js's own "push" handler
// (always calls showNotification(), foreground or not) via a local
// notification instead, since there's no direct "show this system
// notification now" call in the push-notifications plugin itself. Mounted
// once at the root layout (native platforms only) rather than inside
// native-subscribe.ts's subscribe flow, since that flow's own
// removeAllListeners() cleanup would tear this down too if it lived there.
export function NativePushListener() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePushSupported()) return;

    function openUrl(url: string | undefined) {
      router.push(url && url.startsWith("/") ? url : "/");
    }

    const receivedHandle = PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title: notification.title || "My Fit Pod",
              body: notification.body || "",
              extra: { url: notification.data?.url },
            },
          ],
        }).catch((err) => console.error("[push] failed to show foreground notification", err));
      }
    );

    // Tapping a real system notification FCM built itself (app was
    // backgrounded/killed when it arrived).
    const tappedHandle = PushNotifications.addListener("pushNotificationActionPerformed", (action: ActionPerformed) => {
      openUrl(action.notification.data?.url);
    });

    // Tapping the local notification scheduled above (app was foregrounded
    // when it arrived).
    const localTappedHandle = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (action: LocalActionPerformed) => {
        openUrl(action.notification.extra?.url);
      }
    );

    return () => {
      receivedHandle.then((h) => h.remove());
      tappedHandle.then((h) => h.remove());
      localTappedHandle.then((h) => h.remove());
    };
  }, [router]);

  return null;
}
