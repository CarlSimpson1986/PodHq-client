import type { ReactNode } from "react";

// Shared building blocks for the Coach section's tabs (Dashboard, Profile,
// Workout, Nutrition) — extracted here once more than one /coach/* page
// needed them, rather than duplicating.
export function SectionHeading({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">{children}</p>;
}

export function ComingSoonCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-card-light-border p-5 opacity-70">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-card-light-muted">{body}</p>
    </div>
  );
}
