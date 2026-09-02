"use client";

import { useEffect, useState } from "react";
import { TOUR_STEPS } from "@/lib/tour-steps";
import { getTourResumeIndex } from "@/lib/tour-state";
import { TourRunner } from "@/components/tour-runner";

// Mounted on every page the multi-page tour can land on other than Home
// (/book, /shop) — renders nothing for a normal visit. Reads sessionStorage
// in an effect, not during render, so the server-rendered/first-client-
// render output stays consistently empty and hydration never mismatches;
// the actual TourRunner only mounts after that check confirms a resume is
// genuinely pending for *this* page.
export function TourContinuation({ path }: { path: string }) {
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);

  useEffect(() => {
    // Deferred a frame, same pattern as pod-assist-bubble.tsx's animateIn —
    // satisfies react-hooks/set-state-in-effect (no bare synchronous
    // setState in the effect body) while still running once on mount.
    const id = requestAnimationFrame(() => {
      const idx = getTourResumeIndex();
      if (idx !== null && TOUR_STEPS[idx]?.path === path) {
        setResumeIndex(idx);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [path]);

  if (resumeIndex === null) return null;
  return <TourRunner path={path} startIndex={resumeIndex} />;
}
