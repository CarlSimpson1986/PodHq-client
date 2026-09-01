"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MenuIcon, HeartPulseIcon, TrophyIcon, UserIcon, HomeIcon } from "@/components/icons";

const MENU_ITEMS = [
  { href: "/health", label: "Health", icon: HeartPulseIcon },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  { href: "/coach/profile", label: "Profile", icon: UserIcon },
  { href: "/", label: "Home", icon: HomeIcon },
] as const;

// Overflow menu for the flat Dashboard/Training/Nutrition/More nav
// (2026-08-25 redesign, Coach replaced by More 2026-09-01 once Pod Coach
// became a floating bubble instead of a dedicated tab — see
// member-bottom-nav.tsx) — Health stopped being a primary tab ("the
// Health tab still seems a bit pointless", Carl) in favour of this
// overflow; the wearable/recovery integration still needs a home, so it
// moved here alongside Profile and a direct way back to the main app's
// booking area, which nothing in this section otherwise links to.
//
// Two render sites need two shapes from the same menu: a standalone
// circular icon-button (PageHero's rightSlot, opens downward) and, now,
// the 4th flat bottom-nav tab itself (opens upward — a bottom-anchored
// tab's dropdown would render off-screen below the viewport otherwise).
// `variant` picks the trigger's look and the panel's anchor; the
// dropdown items/logic are identical either way, no duplication.
export function MoreMenu({ variant = "icon", active = false }: { variant?: "icon" | "tab"; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={variant === "tab" ? "relative flex flex-1" : "relative"}>
      {variant === "tab" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="More"
          aria-expanded={open}
          className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
            active || open ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <MenuIcon className="h-6 w-6" />
          More
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="More"
          aria-expanded={open}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border text-foreground hover:bg-card-border"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div
          className={`absolute z-20 w-48 overflow-hidden rounded-xl border border-card-border bg-card shadow-lg ${
            variant === "tab" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "right-0 top-16"
          }`}
        >
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-card-border"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
