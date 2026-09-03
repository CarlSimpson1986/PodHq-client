"use client";

import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { COACH_TOUR_STEPS } from "@/lib/coach-tour-steps";

// Pod Coach's own tour, single-page only (Dashboard) — the simpler mirror
// of tour-runner.tsx, which exists to hand a multi-step tour off across
// Home/Shop/Book. Built with the same fixes that tour-runner.tsx needed
// after a live session (2026-09-03) found them broken there first:
// - driver.js skips its own default close/advance entirely once you
//   supply a custom onDoneClick/onCloseClick — every branch that isn't
//   followed by unmount must call driverRef.current?.destroy() itself.
// - the final step targets #tour-coach-label (a plain span), not the
//   real Pod Coach button — highlighting a live interactive control in
//   the same corner driver.js's own popover renders in is what broke
//   Done/X for Pod Assist's tour.
function setPodCoachGlow(on: boolean) {
  document.getElementById("tour-coach-button")?.classList.toggle("pod-assist-glow", on);
}

export function CoachTourRunner({ onComplete }: { onComplete?: () => void }) {
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    if (COACH_TOUR_STEPS.length === 0) return;
    let handled = false;

    driverRef.current = driver({
      showProgress: true,
      smoothScroll: true,
      allowClose: true,
      waitForElement: 1500,
      stagePadding: 14,
      steps: COACH_TOUR_STEPS,
      onCloseClick: () => {
        handled = true;
        setPodCoachGlow(false);
        onComplete?.();
        driverRef.current?.destroy();
      },
      onDestroyed: () => {
        // Fallback only — covers reaching Done on the real final step
        // (driver.js's own default advance still runs to completion
        // there since we never override onNextClick) plus any other
        // path that destroys without onCloseClick having already run.
        if (!handled) {
          handled = true;
          setPodCoachGlow(false);
          onComplete?.();
        }
      },
    });
    setPodCoachGlow(true);
    driverRef.current.drive();

    return () => {
      setPodCoachGlow(false);
      driverRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
