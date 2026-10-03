"use client";

import { useState } from "react";

// Shared technique-video player (2026-10-03). Before this, every spot
// rendered a bare <video>/<iframe> straight into the card, so a member saw
// an empty box until the first frame arrived — slow on mobile data, and
// it read as broken. Now: dark backdrop + spinner until the clip (or the
// YouTube embed) has something to show.

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    </div>
  );
}

export function ExerciseVideo({ src, className = "" }: { src: string; className?: string }) {
  // Tracks which src finished loading, not a plain boolean — the same
  // instance gets reused as a member moves exercise to exercise, and a
  // boolean would stay true and skip the spinner for the next clip.
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const ready = readySrc === src;
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg border border-card-light-border bg-black ${className}`}>
      {/* Own uploaded clip (see podHq's exercise-videos admin page) — no YouTube branding, no iframe. */}
      <video
        key={src}
        src={src}
        controls
        playsInline
        preload="auto"
        onLoadedData={() => setReadySrc(src)}
        className="h-full w-full"
      />
      {!ready && <LoadingOverlay />}
    </div>
  );
}

export function ExerciseYoutubeEmbed({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const ready = readySrc === src;
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-lg border border-card-light-border bg-black ${className}`}>
      <iframe
        key={src}
        src={src}
        title={title}
        className="h-full w-full"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
        onLoad={() => setReadySrc(src)}
      />
      {!ready && <LoadingOverlay />}
    </div>
  );
}

// Warms the browser's media cache for the clip a member will need next, so
// tapping on to the next exercise doesn't start from zero. Hidden, muted,
// never played — just preload="auto".
export function PreloadExerciseVideo({ src }: { src: string | undefined }) {
  if (!src) return null;
  return <video key={src} src={src} preload="auto" muted playsInline className="hidden" aria-hidden="true" />;
}
