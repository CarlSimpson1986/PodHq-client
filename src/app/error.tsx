"use client";

import { useEffect } from "react";

// Root-level error boundary — catches anything thrown while rendering a
// page or its data fetches that isn't caught by a more specific error.tsx
// further down the tree. Added 2026-09-07 pre-launch review: none existed
// anywhere in the app (not even here), despite this being a "non-
// negotiable" rule in this repo's own CLAUDE.md — a single Supabase
// hiccup on any page fell through to Next's generic unstyled default
// error screen instead of a branded, recoverable state. This one file
// covers every route that doesn't define its own (App Router error
// boundaries apply to their whole segment subtree), rather than
// duplicating the same UI into all 30+ page folders.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error boundary]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="card-light w-full max-w-sm p-6">
        <p className="text-base font-semibold">Something went wrong</p>
        <p className="mt-2 text-sm text-card-light-muted">
          That didn&apos;t load properly. Give it another try — if it keeps happening, let gym staff know.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
