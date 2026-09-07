// Root-level loading fallback — shown via the automatic Suspense boundary
// Next wraps around this segment (and every child route that doesn't
// define its own more specific loading.tsx) while a page's server-side
// data fetches are still in flight. Added 2026-09-07 pre-launch review:
// none existed anywhere in the app despite this repo's own CLAUDE.md
// requiring "loading states on every data fetch" — every page's data
// fetch previously showed a blank screen until it resolved.
export default function RootLoading() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center py-12">
      <div
        role="status"
        aria-label="Loading"
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
      />
    </main>
  );
}
