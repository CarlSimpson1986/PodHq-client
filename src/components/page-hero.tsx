import type { ComponentType, ReactNode } from "react";
import Link from "next/link";

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
  iconHref,
  rightSlot,
}: {
  title: string;
  // Optional (2026-09-06) — the workout page dropped its "Your AI Coach"
  // subtitle as unneeded, and forcing every other caller to keep passing
  // one would be worse than just allowing this to be omitted.
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  // Only pass this on pages behind auth — the icon becomes a link to
  // /profile. Left unset on the auth pages (login/signup/forgot-password)
  // that also use this component, since there's no profile to link to
  // before signing in.
  iconHref?: string;
  // Overrides the icon-link entirely with a custom element (e.g.
  // <MoreMenu />, 2026-08-25 redesign) — pass this instead of icon/
  // iconHref when the page needs more than a single link in the corner.
  rightSlot?: ReactNode;
}) {
  const iconCircleClass =
    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border text-foreground";

  return (
    <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {rightSlot ? (
          rightSlot
        ) : Icon && iconHref ? (
          <Link href={iconHref} className={`${iconCircleClass} hover:bg-card-border`}>
            <Icon className="h-7 w-7" />
          </Link>
        ) : Icon ? (
          <div className={iconCircleClass}>
            <Icon className="h-7 w-7" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
