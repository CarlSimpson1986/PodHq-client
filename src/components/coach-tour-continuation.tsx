"use client";

import { useEffect, useState } from "react";
import { COACH_TOUR_STEPS } from "@/lib/coach-tour-steps";
import { getCoachTourResumeIndex } from "@/lib/coach-tour-state";
import { CoachTourRunner } from "@/components/coach-tour-runner";

// Mounted on every page the Coach tour can land on other than Dashboard
// (/training, /nutrition) — renders nothing on a normal visit, exact same
// shape as tour-continuation.tsx (Pod Assist's own). Only actually runs
// CoachTourRunner when a resume is genuinely pending for *this* page,
// checked in an effect rather than during render so server/first-client-
// render output stays consistently empty and hydration never mismatches.
export function CoachTourContinuation({ path }: { path: string }) {
  const [resumeIndex, setResumeIndex] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const idx = getCoachTourResumeIndex();
      if (idx !== null && COACH_TOUR_STEPS[idx]?.path === path) {
        setResumeIndex(idx);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [path]);

  if (resumeIndex === null) return null;
  return <CoachTourRunner path={path} startIndex={resumeIndex} />;
}
