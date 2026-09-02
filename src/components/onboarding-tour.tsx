"use client";

import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { PodAssistBubble } from "@/components/pod-assist-bubble";

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
      description: "Tap here any time to replay this tour or chat with Pod Assist.",
    },
  },
];

// Guided first-login walkthrough (driver.js), fronted by a Pod Assist
// welcome (2026-09-02) — first login no longer launches the tour cold;
// Pod Assist opens with a personalised greeting first ("who you are, and
// I'll show you around"), and driver.js only runs once the member taps
// through from there. tourCompletedAt is null until that first welcome is
// dismissed (closing the chat) or the tour itself finishes — whichever
// happens first — so it never nags a returning member. The "?" button
// still opens Chat directly on every later visit (2026-08-26 — was a
// two-item dropdown menu with "Replay app tour"/"Chat", but the tour
// option was redundant with the "Replay app tour" chip already inside the
// chat panel itself, so the member saw the same option twice on the very
// first tap). v1 is deliberately scoped to the home screen only (no
// cross-page steps) — see podhq-client's ROADMAP.md for why. The static
// FAQ page (and its own "Replay app tour" button, which used to
// force-launch the tour from there via a `?tour=replay` query param)
// was removed 2026-08-22 once Chat graduated to a real LLM covering the
// same 3 questions plus the full Ts & Cs — this is now the only page
// with a "?" button, so that cross-page mechanism no longer has a caller.
export function OnboardingTour({
  tourCompletedAt,
  memberName,
  gym,
}: {
  tourCompletedAt: string | null;
  memberName: string;
  gym: string;
}) {
  const driverRef = useRef<Driver | null>(null);
  const firstLogin = tourCompletedAt === null;
  const tourCompleteCalled = useRef(false);

  function markTourComplete() {
    if (tourCompleteCalled.current) return;
    tourCompleteCalled.current = true;
    fetch("/api/member/tour-complete", { method: "POST" }).catch(() => {
      // Non-critical — worst case the welcome/tour auto-launches again
      // next session. Not surfaced to the member.
    });
  }

  useEffect(() => {
    driverRef.current = driver({
      showProgress: true,
      allowClose: true,
      onDestroyed: () => {
        if (firstLogin) markTourComplete();
      },
      steps: STEPS,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = memberName.split(" ")[0] || memberName;

  return (
    <PodAssistBubble
      initialOpen={firstLogin}
      welcomeMessage={
        firstLogin
          ? `Hi ${firstName}, welcome to My Fit Pod! You're all set up at ${gym}. I'm Pod Assist — ask me anything about bookings, credits, or gym policies any time. Want the 30-second tour of the app first?`
          : undefined
      }
      tourCtaLabel={firstLogin ? "Show me around" : "Replay app tour"}
      onReplayTour={() => driverRef.current?.drive()}
      onClose={firstLogin ? markTourComplete : undefined}
    />
  );
}
