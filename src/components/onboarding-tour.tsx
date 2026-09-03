"use client";

import { useRef, useState } from "react";
import { PodAssistBubble } from "@/components/pod-assist-bubble";
import { TourRunner } from "@/components/tour-runner";

// Home's entry point into the full, multi-page guided tour (tour-steps.ts,
// tour-runner.tsx) — first login no longer launches it cold. Pod Assist
// opens with a personalised greeting first ("who you are, and I'll show
// you around"), and TourRunner only starts once the member taps through
// from there, beginning at step 0 (Home) and continuing across /book and
// /shop on its own — see tour-runner.tsx for how it hands off between
// pages. tourCompletedAt is null until that first welcome is dismissed
// (closing the chat) or the whole tour finishes on whichever page it
// ends on — whichever happens first — so it never nags a returning
// member. The "?" button still opens Chat directly on every later visit
// (2026-08-26 — was a two-item dropdown menu with "Replay app tour"/
// "Chat", but the tour option was redundant with the "Replay app tour"
// chip already inside the chat panel itself, so the member saw the same
// option twice on the very first tap). The static FAQ page (and its own
// "Replay app tour" button, which used to force-launch the tour from
// there via a `?tour=replay` query param) was removed 2026-08-22 once
// Chat graduated to a real LLM covering the same 3 questions plus the
// full Ts & Cs — this is now the only page with a "?" button, so that
// cross-page mechanism no longer has a caller.
export function OnboardingTour({
  tourCompletedAt,
  memberName,
  gym,
}: {
  tourCompletedAt: string | null;
  memberName: string;
  gym: string;
}) {
  const firstLogin = tourCompletedAt === null;
  const [tourStarted, setTourStarted] = useState(false);
  const tourCompleteCalled = useRef(false);

  function markTourComplete() {
    if (tourCompleteCalled.current) return;
    tourCompleteCalled.current = true;
    fetch("/api/member/tour-complete", { method: "POST" }).catch(() => {
      // Non-critical — worst case the welcome/tour auto-launches again
      // next session. Not surfaced to the member.
    });
  }

  const firstName = memberName.split(" ")[0] || memberName;

  return (
    <>
      <PodAssistBubble
        initialOpen={firstLogin}
        welcomeMessage={
          firstLogin
            ? `Hi ${firstName}, welcome to My Fit Pod! You're all set up at ${gym}. I'm Pod Assist — ask me anything about bookings, credits, or gym policies, any time you get stuck, just tap this icon. Here's a quick tour to get you started — how to buy credits or a membership, and how to book a session.`
            : undefined
        }
        tourCtaLabel={firstLogin ? "Show me around" : "Replay app tour"}
        onReplayTour={() => setTourStarted(true)}
        onClose={firstLogin ? markTourComplete : undefined}
      />
      {tourStarted && (
        <TourRunner path="/" startIndex={0} onComplete={() => setTourStarted(false)} />
      )}
    </>
  );
}
