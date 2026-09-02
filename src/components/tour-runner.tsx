"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_STEPS } from "@/lib/tour-steps";
import { setTourResumeIndex, clearTourResume } from "@/lib/tour-state";

function markTourComplete() {
  fetch("/api/member/tour-complete", { method: "POST" }).catch(() => {
    // Non-critical — worst case the tour auto-launches again next
    // session. Not surfaced to the member.
  });
}

/**
 * Drives whichever contiguous run of TOUR_STEPS shares `path`, starting
 * at `startIndex`. Mounted three ways: directly by OnboardingTour on Home
 * when "Show me around" is tapped (startIndex 0), and passively via
 * TourContinuation on /book and /shop, which only render this at all when
 * a cross-page resume is actually pending for that page — see
 * tour-continuation.tsx.
 *
 * driver.js's onDoneClick vs onCloseClick distinction (not just
 * onDestroyed, which fires either way) is what makes "finished this
 * page's steps, continue to the next page" and "closed early, stop the
 * whole tour" behave differently — an early close must never force-
 * navigate the member somewhere they didn't ask to go.
 */
export function TourRunner({ path, startIndex }: { path: string; startIndex: number }) {
  const router = useRouter();
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    const slice = [];
    let i = startIndex;
    while (i < TOUR_STEPS.length && TOUR_STEPS[i].path === path) {
      slice.push(TOUR_STEPS[i]);
      i++;
    }
    if (slice.length === 0) return;
    const nextIndex = i;
    let handled = false;

    driverRef.current = driver({
      showProgress: true,
      allowClose: true,
      waitForElement: 1500,
      steps: slice.map((s) => ({ element: s.element, popover: s.popover })),
      onDoneClick: () => {
        handled = true;
        if (nextIndex < TOUR_STEPS.length) {
          setTourResumeIndex(nextIndex);
          router.push(TOUR_STEPS[nextIndex].path);
        } else {
          clearTourResume();
          markTourComplete();
        }
      },
      onCloseClick: () => {
        handled = true;
        clearTourResume();
        markTourComplete();
      },
      onDestroyed: () => {
        // Fallback only — a missing element or any other path that
        // reaches destroy() without onDoneClick/onCloseClick already
        // having run. Never leave a stale resume pointer that silently
        // re-triggers the tour on some unrelated future page.
        if (!handled) {
          clearTourResume();
          markTourComplete();
        }
      },
    });
    driverRef.current.drive();

    return () => {
      driverRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
