"use client";

import { useEffect, useState } from "react";

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
  // Lazy initializers rather than setting these from inside an effect — a
  // newer eslint-plugin-react-hooks (2026-08-16 dependency upgrade)
  // promotes synchronous setState-in-effect from warning to error, same
  // fix pattern as turnstile-widget.tsx/install-app-card.tsx.
  const [installed, setInstalled] = useState(isStandalone);
  const [ios] = useState(isIOS);
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
