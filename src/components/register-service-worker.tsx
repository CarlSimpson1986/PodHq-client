"use client";

import { useEffect } from "react";

// Registers sw.js on every page load so the offline/flaky-signal cache (see
// public/sw.js) is active from a member's first visit, not only once they
// opt into push notifications (subscribeToPush also calls register() — the
// browser treats a second registration of the same script URL as a no-op
// against the existing one, so there's no conflict between the two).
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
