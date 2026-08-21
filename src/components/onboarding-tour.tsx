"use client";

import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

const STEPS: NonNullable<Parameters<typeof driver>[0]>["steps"] = [
  {
    element: "#tour-greeting",
    popover: {
      title: "Welcome to My Fit Pod",
      description: "Quick tour of the app — takes about 30 seconds. Tap the \"?\" any time to see it again.",
    },
  },
  {
    element: "#tour-credits",
    popover: {
      title: "Your credits",
      description: "Each session uses one credit. Top up any time from the Shop tab.",
    },
  },
  {
    element: "#tour-session-card",
    popover: {
      title: "Book a session",
      description: "Your next booking shows here. No upcoming session yet? Tap through to book one.",
    },
  },
  {
    element: "#tour-nav-book",
    popover: {
      title: "Book",
      description: "Pick a time and unlock the pod door straight from your booking.",
    },
  },
  {
    element: "#tour-nav-shop",
    popover: {
      title: "Shop",
      description: "Buy credit packs, memberships, or a gift voucher.",
    },
  },
  {
    element: "#tour-nav-profile",
    popover: {
      title: "Profile",
      description: "Your details, waiver, and booking history live here.",
    },
  },
  {
    element: "#tour-help-button",
    popover: {
      title: "Need this again?",
      description: "Tap here any time to replay this tour.",
    },
  },
];

// Guided first-login walkthrough (driver.js). Auto-runs once per member —
// tourCompletedAt is null until the tour finishes or is closed early, then
// the "?" button below replays it on demand without touching that flag
// again. v1 is deliberately scoped to the home screen only (no cross-page
// steps) — see podhq-client's ROADMAP.md for why.
export function OnboardingTour({ tourCompletedAt }: { tourCompletedAt: string | null }) {
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    driverRef.current = driver({
      showProgress: true,
      allowClose: true,
      onDestroyed: () => {
        if (tourCompletedAt === null) {
          fetch("/api/member/tour-complete", { method: "POST" }).catch(() => {
            // Non-critical — worst case the tour auto-launches again next
            // session. Not surfaced to the member.
          });
        }
      },
      steps: STEPS,
    });

    if (tourCompletedAt === null) {
      // Let the home screen finish rendering before highlighting elements.
      const timer = setTimeout(() => driverRef.current?.drive(), 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      id="tour-help-button"
      onClick={() => driverRef.current?.drive()}
      aria-label="Replay app tour"
      className="fixed right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-lg"
    >
      ?
    </button>
  );
}
