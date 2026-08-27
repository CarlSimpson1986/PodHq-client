"use client";

import { useState } from "react";
import { HealthTrendLine } from "@/components/health-trend-line";

// No per-member step goal exists anywhere yet (checked) — 10,000/day is
// the common general-population target and a reasonable default until
// there's a real reason to make it configurable (2026-08-27).
const DEFAULT_STEP_TARGET = 10000;
const RADIUS = 50;
const ARC_LENGTH = Math.PI * RADIUS; // half the circle's circumference

export function StepGauge({ current, points }: { current: number | null; points: { date: string; value: number }[] }) {
  const [expanded, setExpanded] = useState(false);
  const pct = current !== null ? Math.min(100, (current / DEFAULT_STEP_TARGET) * 100) : 0;
  const offset = ARC_LENGTH - (pct / 100) * ARC_LENGTH;

  return (
    <div className="card-light">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full p-5 text-center">
        <p className="text-left text-sm font-semibold">Steps</p>
        <div className="relative mx-auto mt-1 w-full max-w-[220px]">
          <svg viewBox="0 0 120 65" className="w-full">
            <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" strokeWidth="10" strokeLinecap="round" className="stroke-card-light-border" />
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={ARC_LENGTH}
              strokeDashoffset={offset}
              className="stroke-card-light-foreground transition-all"
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <p className="text-xl font-semibold">{current !== null ? current.toLocaleString("en-GB") : "—"}</p>
            <p className="text-xs text-card-light-muted">of {DEFAULT_STEP_TARGET.toLocaleString("en-GB")}</p>
          </div>
        </div>
        <p className="mt-1 text-xs text-card-light-muted">{expanded ? "Hide trend −" : "Show trend +"}</p>
      </button>
      {expanded && (
        <div className="border-t border-card-light-border px-5 pb-5 pt-4">
          <HealthTrendLine points={points} />
          <p className="mt-1 text-xs text-card-light-muted">Last {points.length} days with data</p>
        </div>
      )}
    </div>
  );
}
