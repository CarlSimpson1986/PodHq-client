"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "podhq-install-prompt-dismissed";

// Chrome/Android fires this and lets us trigger the native install flow
// programmatically. iOS Safari has no equivalent API at all — Add to Home
// Screen is a manual Share-sheet action with no way to prompt or even
// detect it from the page, so iOS gets static instructions instead.
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

// Lazy initializers rather than setting these from inside the effect below
// — a newer eslint-plugin-react-hooks (pulled in by the 2026-08-16
// dependency upgrade) promotes synchronous setState-in-effect from warning
// to error. Guarded for SSR (no window/localStorage there); the client's
// first render recomputes the real value immediately, same trade-off
// turnstile-widget.tsx already accepts elsewhere in this codebase.
function initialDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return isStandalone() || localStorage.getItem(DISMISSED_KEY) === "1";
}

export function InstallAppCard() {
  const [dismissed, setDismissed] = useState(initialDismissed);
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

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") dismiss();
  }

  // Android/Chrome without a fired beforeinstallprompt yet (e.g. already
  // dismissed by the browser's own heuristics this session) has nothing
  // useful to show — no native prompt to trigger and no manual steps as
  // simple as iOS's, so stay silent rather than show a dead-end card.
  if (dismissed || (!ios && !installPrompt)) return null;

  return (
    <div className="rounded-xl border border-card-light-border bg-card-light-foreground/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Install this app</p>
          <p className="mt-1 text-sm text-card-light-muted">
            {ios
              ? "Tap the Share icon, then \"Add to Home Screen\" for quick access, even with poor signal at the gym."
              : "Add it to your home screen for quick access, even with poor signal at the gym."}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-lg leading-none text-card-light-muted hover:text-card-light-foreground"
        >
          ×
        </button>
      </div>
      {!ios && (
        <button
          onClick={install}
          className="mt-3 rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Install
        </button>
      )}
    </div>
  );
}
