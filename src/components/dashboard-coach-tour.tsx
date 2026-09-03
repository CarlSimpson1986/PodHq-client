"use client";

import { useState } from "react";
import { PodCoachBubble } from "@/components/pod-coach-bubble";
import { CoachTourRunner } from "@/components/coach-tour-runner";
import type { CheckInState } from "@/lib/coach/checkin-state";
import type { ChatMessage } from "@/components/coach-chat-view";

// Dashboard's entry point into the Coach tour (coach-tour-steps.ts,
// coach-tour-runner.tsx) — the Premium-side mirror of Home's
// onboarding-tour.tsx. Pod Coach's welcome message offers "Show me
// around" first time (isFirstWelcome, matching dashboard/page.tsx's
// showCoachWelcome), "Replay app tour" every time after.
export function DashboardCoachTour({
  checkInState,
  initialMessages,
  hasAcceptedPrivacyPolicy,
  initialOpen,
  isFirstWelcome,
}: {
  checkInState: CheckInState;
  initialMessages: ChatMessage[];
  hasAcceptedPrivacyPolicy: boolean;
  initialOpen: boolean;
  isFirstWelcome: boolean;
}) {
  const [tourStarted, setTourStarted] = useState(false);

  return (
    <>
      <PodCoachBubble
        checkInState={checkInState}
        initialMessages={initialMessages}
        hasAcceptedPrivacyPolicy={hasAcceptedPrivacyPolicy}
        initialOpen={initialOpen}
        onReplayTour={() => setTourStarted(true)}
        tourCtaLabel={isFirstWelcome ? "Show me around" : "Replay app tour"}
      />
      {tourStarted && <CoachTourRunner onComplete={() => setTourStarted(false)} />}
    </>
  );
}
