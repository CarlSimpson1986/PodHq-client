"use client";

import { useEffect, useRef, useState } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { HelpChatView } from "@/components/help-chat-view";

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

// Guided first-login walkthrough (driver.js). Auto-runs once per member —
// tourCompletedAt is null until the tour finishes or is closed early.
// The "?" button opens Chat directly (2026-08-26 — was a two-item
// dropdown menu with "Replay app tour"/"Chat", but the tour option was
// redundant with the "Replay app tour" chip already inside the chat
// panel itself, so the member saw the same option twice on the very
// first tap). v1 is deliberately scoped to the home screen only (no
// cross-page steps) — see podhq-client's ROADMAP.md for why. The static
// FAQ page (and its own "Replay app tour" button, which used to
// force-launch the tour from there via a `?tour=replay` query param)
// was removed 2026-08-22 once Chat graduated to a real LLM covering the
// same 3 questions plus the full Ts & Cs — this is now the only page
// with a "?" button, so that cross-page mechanism no longer has a caller.
export function OnboardingTour({ tourCompletedAt }: { tourCompletedAt: string | null }) {
  const driverRef = useRef<Driver | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

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
    <div className="fixed right-4 top-4 z-20">
      <button
        type="button"
        id="tour-help-button"
        onClick={() => setChatOpen(true)}
        aria-label="Pod Assist"
        className="flex h-10 w-10 items-center justify-center text-white drop-shadow-lg"
      >
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none">
          <path
            d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v9A2.5 2.5 0 0 1 18.5 18H11l-4.5 4v-4H5.5A2.5 2.5 0 0 1 3 15.5v-9Z"
            fill="currentColor"
          />
          <path
            d="M9.9 9.3c.2-1.1 1.2-1.9 2.4-1.9 1.25 0 2.3.8 2.3 1.95 0 1-.65 1.4-1.35 1.85-.65.4-1.15.75-1.15 1.6"
            stroke="#0a0a0b"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="12.1" cy="15.6" r="0.9" fill="#0a0a0b" />
        </svg>
      </button>
      {chatOpen && (
        <div className="fixed inset-x-4 bottom-4 top-20 z-30 flex flex-col overflow-hidden rounded-2xl border border-card-light-border bg-card-light shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="flex items-center justify-between border-b border-card-light-border px-4 py-3">
            <p className="text-sm font-semibold text-card-light-foreground">Pod Assist</p>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-card-light-muted hover:bg-card-light-border"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <HelpChatView
              onReplayTour={() => {
                setChatOpen(false);
                driverRef.current?.drive();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
