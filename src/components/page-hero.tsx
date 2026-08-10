import type { ComponentType } from "react";

// Full-width dark banner at the top of a page, flowing directly into a
// flat white content area below (no rounded overlap) — matches GymFlow's
// own monochrome black/white layout as closely as this app's required
// dark theme allows (CLAUDE.md: dark-only, no light mode) — the header
// itself stays dark, but neither it nor the content below uses any accent
// color; black/white/grey only, per the 2026-08-10 redesign. Used by every
// auth page and /buy-credits; /book has its own variant (booking-grid.tsx)
// since it also needs the credits/"Buy more" row inside the banner.
export function PageHero({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border text-foreground">
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </div>
  );
}
