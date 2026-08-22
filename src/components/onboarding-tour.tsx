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
      description: "Tap here any time to replay this tour or chat with our help assistant.",
    },
  },
];

// Guided first-login walkthrough (driver.js). Auto-runs once per member —
// tourCompletedAt is null until the tour finishes or is closed early, then
// the "?" menu below can replay it on demand without touching that flag
// again, or open the Chat panel. v1 is deliberately scoped to the home
// screen only (no cross-page steps) — see podhq-client's ROADMAP.md for
// why. The static FAQ page (and its own "Replay app tour" button, which
// used to force-launch the tour from there via a `?tour=replay` query
// param) was removed 2026-08-22 once Chat graduated to a real LLM
// covering the same 3 questions plus the full Ts & Cs — this is now the
// only page with a "?" button, so that cross-page mechanism no longer has
// a caller.
export function OnboardingTour({ tourCompletedAt }: { tourCompletedAt: string | null }) {
  const driverRef = useRef<Driver | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="fixed right-4 top-4 z-20">
      <button
        type="button"
        id="tour-help-button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Help"
        aria-expanded={menuOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-lg"
      >
        ?
      </button>
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-card-light-border bg-card-light shadow-lg">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              driverRef.current?.drive();
            }}
            className="block w-full px-4 py-3 text-left text-sm font-medium text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
          >
            Replay app tour
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setChatOpen(true);
            }}
            className="block w-full border-t border-card-light-border px-4 py-3 text-left text-sm font-medium text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
          >
            Chat
          </button>
        </div>
      )}
      {chatOpen && (
        <div className="fixed inset-x-4 bottom-4 top-20 z-30 flex flex-col overflow-hidden rounded-2xl border border-card-light-border bg-card-light shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="flex items-center justify-between border-b border-card-light-border px-4 py-3">
            <p className="text-sm font-semibold text-card-light-foreground">Chat</p>
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
            <HelpChatView />
          </div>
        </div>
      )}
    </div>
  );
}
