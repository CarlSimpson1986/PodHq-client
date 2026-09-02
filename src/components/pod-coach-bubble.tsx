"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CoachChatView, type ChatMessage } from "@/components/coach-chat-view";
import { PrivacyConsentForm } from "@/components/privacy-consent-form";
import type { CheckInState } from "@/lib/coach/checkin-state";

// Pod Coach's floating bubble — replaces the old dedicated /coach tab
// (2026-09-01, Carl: premium pages get Pod Coach as a bubble, non-premium
// pages get Pod Assist as one — see onboarding-tour.tsx, the mirror of
// this on the other side of that split). Mounted directly on Dashboard/
// Training/Nutrition (each fetches its own data and passes it down — no
// shared layout for these pages to hook a single mount point into), same
// top-right fixed position Pod Assist uses since the two never share a
// screen.
//
// Check-in lives here now too, not as a separate page reached from a
// hub — "ask a question, and underneath, complete your check-in" (Carl).
// Still links out to /coach/checkin for the actual multi-step flow
// (weight, mood, habits) rather than reinventing that inline; only
// clickable when actually due/overdue, otherwise shown greyed out with
// the days-remaining countdown so it's still visible, just not a dead
// end tap.
export function PodCoachBubble({
  checkInState,
  initialMessages,
  hasAcceptedPrivacyPolicy,
  initialOpen = false,
}: {
  checkInState: CheckInState;
  initialMessages: ChatMessage[];
  hasAcceptedPrivacyPolicy: boolean;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  // Same two-phase mount as Pod Assist's bubble (pod-assist-bubble.tsx) —
  // transitions in from the icon's own corner instead of snapping into
  // place, including on the trial-welcome auto-open, not just later taps.
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  function closeChat() {
    setOpen(false);
    setAnimateIn(false);
  }

  return (
    <div className="fixed right-4 top-4 z-20">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pod Coach"
        className="flex h-10 w-10 items-center justify-center drop-shadow-lg"
      >
        <Image src="/icons/features/pod-coach-mark.png" alt="" width={40} height={40} />
      </button>
      {open && (
        <div
          className={`fixed inset-x-4 bottom-4 top-20 z-30 flex origin-top-right flex-col overflow-hidden rounded-2xl border border-card-light-border bg-card-light shadow-2xl transition-all duration-200 ease-out sm:inset-x-auto sm:right-4 sm:w-96 ${
            animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-card-light-border px-4 py-3">
            <p className="text-sm font-semibold text-card-light-foreground">Pod Coach</p>
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close chat"
              className="flex h-7 w-7 items-center justify-center rounded-full text-card-light-muted hover:bg-card-light-border"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CheckInPrompt state={checkInState} />
            <div className="mt-4">
              {hasAcceptedPrivacyPolicy ? (
                <CoachChatView initialMessages={initialMessages} onDismiss={closeChat} />
              ) : (
                <PrivacyConsentForm />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckInPrompt({ state }: { state: CheckInState }) {
  if (state.kind === "no_profile") return null;

  if (state.kind === "not_due") {
    return (
      <div className="card-light p-4 opacity-50">
        <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Check-in</p>
        <p className="mt-1 text-sm font-semibold">
          {state.daysRemaining} {state.daysRemaining === 1 ? "day" : "days"} to your next check-in
        </p>
        <p className="mt-1 text-xs text-card-light-muted">Due {state.nextDueDate}.</p>
      </div>
    );
  }

  return (
    <Link href="/coach/checkin" prefetch={false} className="card-light block p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Check-in</p>
      {state.kind === "due" && (
        <>
          <p className="mt-1 text-sm font-semibold text-warning">Check-in ready</p>
          <p className="mt-1 text-xs text-card-light-muted">See how your week went →</p>
        </>
      )}
      {state.kind === "overdue" && (
        <>
          <p className="mt-1 text-sm font-semibold text-danger">
            Overdue by {state.daysOverdue} {state.daysOverdue === 1 ? "day" : "days"}
          </p>
          <p className="mt-1 text-xs text-card-light-muted">See how your week went →</p>
        </>
      )}
    </Link>
  );
}
