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

// Glows the Pod Assist icon while the tour is driving. Every page mounts
// its own PodAssistBubble with this same stable id, so toggling the class
// directly on the DOM element (rather than threading a `glowing` prop
// through OnboardingTour/TourContinuation, which only Home ever had a path
// for) works uniformly on Home, /shop and /book alike.
function setPodAssistGlow(on: boolean) {
  document.getElementById("tour-help-button")?.classList.toggle("pod-assist-glow", on);
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
 *
 * IMPORTANT: supplying a custom onDoneClick/onCloseClick makes driver.js
 * skip its own default behavior entirely and call *only* your callback —
 * it does not also advance/close the popover for you. Every branch below
 * that isn't followed by a page navigation (which unmounts this component
 * and destroys the instance via the effect cleanup anyway) must call
 * driverRef.current?.destroy() itself, or the popover/overlay just sits
 * there doing nothing when Done/X is clicked (confirmed live 2026-09-03 —
 * X was broken on every step, Done only on the tour's final step, since
 * mid-tour "Next" clicks were the one path still using driver.js's own
 * default advance logic, having never been overridden).
 */
export function TourRunner({
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
    while (i < TOUR_STEPS.length && TOUR_STEPS[i].path === path) {
      slice.push(TOUR_STEPS[i]);
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
        if (nextIndex < TOUR_STEPS.length) {
          setTourResumeIndex(nextIndex);
          driverRef.current?.destroy();
          router.push(TOUR_STEPS[nextIndex].path);
        } else {
          setPodAssistGlow(false);
          clearTourResume();
          markTourComplete();
          onComplete?.();
          driverRef.current?.destroy();
        }
      },
      onCloseClick: () => {
        handled = true;
        setPodAssistGlow(false);
        clearTourResume();
        markTourComplete();
        onComplete?.();
        driverRef.current?.destroy();
      },
      onDestroyed: () => {
        // Fallback only — a missing element or any other path that
        // reaches destroy() without onDoneClick/onCloseClick already
        // having run. Never leave a stale resume pointer that silently
        // re-triggers the tour on some unrelated future page.
        if (!handled) {
          setPodAssistGlow(false);
          clearTourResume();
          markTourComplete();
          onComplete?.();
        }
      },
    });
    setPodAssistGlow(true);
    driverRef.current.drive();

    return () => {
      setPodAssistGlow(false);
      driverRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
