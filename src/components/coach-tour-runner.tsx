"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { COACH_TOUR_STEPS } from "@/lib/coach-tour-steps";
import { setCoachTourResumeIndex, clearCoachTourResume } from "@/lib/coach-tour-state";

// Cross-page Coach tour runner (2026-09-03) — was single-page (Dashboard
// only) until Carl flagged the tour never actually visited /training or
// /nutrition, just Dashboard's own summary cards of them. Now the exact
// same shape as tour-runner.tsx (Pod Assist's), lessons and all:
// - driver.js skips its own default close/advance entirely once you
//   supply a custom onDoneClick/onCloseClick — every branch that isn't
//   followed by a page navigation (which unmounts this component and
//   destroys the instance via the effect cleanup anyway) must call
//   driverRef.current?.destroy() itself.
// - the final step still targets #tour-coach-label (a plain span), not
//   the real #tour-coach-button, for the same reason as Pod Assist's
//   #tour-help-label — a live interactive control in the same corner
//   driver.js's own popover renders in is what broke Done/X there.
function setPodCoachGlow(on: boolean) {
  document.getElementById("tour-coach-button")?.classList.toggle("pod-assist-glow", on);
}

export function CoachTourRunner({
  path,
  startIndex,
  onComplete,
}: {
  path: string;
  startIndex: number;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    const slice = [];
    let i = startIndex;
    while (i < COACH_TOUR_STEPS.length && COACH_TOUR_STEPS[i].path === path) {
      slice.push(COACH_TOUR_STEPS[i]);
      i++;
    }
    if (slice.length === 0) return;
    const nextIndex = i;
    let handled = false;

    driverRef.current = driver({
      showProgress: true,
      smoothScroll: true,
      allowClose: true,
      waitForElement: 1500,
      stagePadding: 14,
      steps: slice.map((s) => ({ element: s.element, popover: s.popover })),
      onDoneClick: () => {
        handled = true;
        if (nextIndex < COACH_TOUR_STEPS.length) {
          setCoachTourResumeIndex(nextIndex);
          driverRef.current?.destroy();
          router.push(COACH_TOUR_STEPS[nextIndex].path);
        } else {
          setPodCoachGlow(false);
          clearCoachTourResume();
          onComplete?.();
          driverRef.current?.destroy();
        }
      },
      onCloseClick: () => {
        handled = true;
        setPodCoachGlow(false);
        clearCoachTourResume();
        onComplete?.();
        driverRef.current?.destroy();
      },
      onDestroyed: () => {
        // Fallback only — a missing element or any other path that
        // reaches destroy() without onDoneClick/onCloseClick already
        // having run. Never leave a stale resume pointer that silently
        // re-triggers the tour on some unrelated future page.
        if (!handled) {
          setPodCoachGlow(false);
          clearCoachTourResume();
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
