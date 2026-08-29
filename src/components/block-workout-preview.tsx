"use client";

import { useState } from "react";
import { getYoutubeVideoId, getYoutubeEmbedTiming } from "@/lib/coach/exercise-catalog";
import type { StoredTemplate } from "@/lib/coach/workout-templates";
import { ChevronRightIcon } from "@/components/icons";

// Tap-to-expand technique video per exercise (2026-08-29, Carl's call) —
// no thumbnail image: img-src is locked to 'self' data: (see proxy.ts's
// CSP), so a live YouTube thumbnail would need a CSP change for a
// preview list. A plain "Watch" toggle needs none — it only ever loads
// the same youtube-nocookie.com embed workout-view.tsx's active-exercise
// screen already uses, and only once tapped.
function ExerciseRow({ ex }: { ex: StoredTemplate["exercises"][number] }) {
  const [playing, setPlaying] = useState(false);
  const videoId = getYoutubeVideoId(ex.key);
  const timing = getYoutubeEmbedTiming(ex.key);
  const params = new URLSearchParams({ rel: "0" });
  if (timing.start !== undefined) params.set("start", String(timing.start));
  if (timing.end !== undefined) params.set("end", String(timing.end));

  return (
    <li>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-card-light-muted">
          {ex.name} <span className="capitalize">({ex.muscleGroup})</span>
        </p>
        {videoId && (
          <button type="button" onClick={() => setPlaying((p) => !p)} className="flex-none text-xs font-semibold underline">
            {playing ? "Hide" : "▶ Watch"}
          </button>
        )}
      </div>
      {playing && videoId && (
        <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg border border-card-light-border">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
            title={`${ex.name} technique demonstration`}
            className="h-full w-full"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </li>
  );
}

// Each Workout letter is its own tap-to-expand card (2026-08-29, Carl's
// call) — "today's pick" opens by default since that's the one a member
// actually cares about right now, the other two start collapsed.
function WorkoutCard({ template, repsTarget, isNext }: { template: StoredTemplate; repsTarget: number; isNext: boolean }) {
  const [expanded, setExpanded] = useState(isNext);

  return (
    <div className="card-light overflow-hidden">
      <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold">
          Workout {template.letter} · {template.exercises.length} exercises · {repsTarget} reps
          {isNext && <span className="rounded-full bg-card-light-foreground px-2 py-0.5 text-xs font-semibold text-white">Today&apos;s pick</span>}
        </span>
        <ChevronRightIcon className={`h-4 w-4 flex-none text-card-light-muted transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <ul className="space-y-2 border-t border-card-light-border p-4 pt-3">
          {template.exercises.map((ex) => (
            <ExerciseRow key={ex.key} ex={ex} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function BlockWorkoutPreview({
  templates,
  repsTarget,
  nextLetter,
}: {
  templates: StoredTemplate[];
  repsTarget: number;
  nextLetter: StoredTemplate["letter"] | null;
}) {
  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <WorkoutCard key={t.id} template={t} repsTarget={repsTarget} isNext={t.letter === nextLetter} />
      ))}
    </div>
  );
}
