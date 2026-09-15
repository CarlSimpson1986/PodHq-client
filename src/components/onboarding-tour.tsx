"use client";

import { useState } from "react";
import { PodAssistBubble } from "@/components/pod-assist-bubble";
import { TourRunner } from "@/components/tour-runner";

// Home's entry point into the full, multi-page guided tour (tour-steps.ts,
// tour-runner.tsx). Restored to auto-run on first login (2026-09-15, Carl:
// "the tour never autostarts") — the 2026-09-02 change that gated it
// behind a manual "Show me around" tap inside Pod Assist's welcome chat
// meant most new members just closed that popup without ever seeing the
// actual walkthrough. TourRunner now mounts immediately for a first-time
// member, beginning at step 0 (Home) and continuing across /book and
// /shop on its own — see tour-runner.tsx for how it hands off between
// pages; its own step 0 popover already carries a welcome greeting, so
// Pod Assist's chat isn't force-opened alongside it (the two would
// otherwise visually collide — the chat panel covers the exact area
// driver.js highlights). Pod Assist's icon/label are always mounted
// regardless (setPodAssistGlow in tour-runner.tsx targets #tour-help-
// button by id, glowing it while the tour drives) so a member can still
// open Chat manually mid- or post-tour; welcomeMessage/tourCtaLabel stay
// wired for that manual open on a first-login member's very first visit,
// and "Replay app tour" afterwards. tourCompletedAt is null until the
// whole tour finishes (or is closed early) — see tour-runner.tsx's
// markTourComplete — so it never nags a returning member.
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
  const [tourStarted, setTourStarted] = useState(firstLogin);

  const firstName = memberName.split(" ")[0] || memberName;

  return (
    <>
      <PodAssistBubble
        welcomeMessage={
          firstLogin
            ? `Hi ${firstName}, welcome to My Fit Pod! You're all set up at ${gym}. I'm Pod Assist — ask me anything about bookings, credits, or gym policies, any time you get stuck, just tap this icon.`
            : undefined
        }
        tourCtaLabel="Replay app tour"
        onReplayTour={() => setTourStarted(true)}
      />
      {tourStarted && (
        <TourRunner path="/" startIndex={0} onComplete={() => setTourStarted(false)} />
      )}
    </>
  );
}
