"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const NOOP_SUBSCRIBE = () => () => {};

// Chrome/Android fires this and lets us trigger the native install flow
// programmatically. iOS Safari has no equivalent API at all — Add to Home
// Screen is a manual Share-sheet action with no way to prompt or even
// detect it from the page, so iOS callers get instructions instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own non-standard flag — matchMedia above doesn't cover it there.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Shared by the bottom-nav install icon — one detection path, one place to fix if platform behavior changes. */
export function useInstallPrompt() {
  // useSyncExternalStore, not a useState lazy initializer — a lazy
  // initializer still runs during React's render phase on both server and
  // client, and since isStandalone()/isIOS() read browser-only globals
  // (window.matchMedia, navigator.userAgent), the client's first render
  // computed a real value against the server's stubbed `false` — a genuine
  // hydration mismatch (React error #418), not a false alarm. Same fix
  // already proven for bookings-view.tsx's notifPermission (found live
  // 2026-08-17); this call site was still on the old broken pattern and
  // resurfaced the identical error on /book once its own timezone-related
  // #418 was fixed, same day. The server snapshot is always `false`,
  // guaranteeing the first client render matches; the real value takes
  // over immediately after hydration commits.
  const standalone = useSyncExternalStore(NOOP_SUBSCRIBE, isStandalone, () => false);
  const ios = useSyncExternalStore(NOOP_SUBSCRIBE, isIOS, () => false);
  const [installedAfterPrompt, setInstalled] = useState(false);
  const installed = standalone || installedAfterPrompt;
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function promptInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
  }

  // Android/Chrome without a fired beforeinstallprompt yet (e.g. already
  // dismissed by the browser's own heuristics this session) has nothing to
  // offer — no native prompt to trigger and no manual steps as simple as
  // iOS's, so treat it the same as "nothing to show" rather than a dead
  // button.
  const installable = !installed && (ios || !!installPrompt);

  return { installable, ios, promptInstall };
}
