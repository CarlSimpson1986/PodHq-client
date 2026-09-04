"use client";

import { useEffect, useState } from "react";

// Module-level cache, not component state — workout-view.tsx and
// block-workout-preview.tsx both need this and shouldn't each trigger
// their own fetch; the whole map rarely changes within a session, and a
// stale map for the rest of one workout is a fine tradeoff against a
// network request per exercise.
let cache: Record<string, string> | null = null;
let inFlight: Promise<Record<string, string>> | null = null;

async function loadOverrides(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch("/api/exercise-videos")
      .then((res) => res.json())
      .then((body) => {
        const result: Record<string, string> = body.status === "ok" ? body.overrides : {};
        cache = result;
        return result;
      })
      .catch(() => {
        const result: Record<string, string> = {};
        cache = result;
        return result;
      });
  }
  return inFlight;
}

export function useExerciseVideoOverrides(): Record<string, string> {
  const [overrides, setOverrides] = useState<Record<string, string>>(cache ?? {});

  useEffect(() => {
    if (cache) return;
    loadOverrides().then(setOverrides);
  }, []);

  return overrides;
}
