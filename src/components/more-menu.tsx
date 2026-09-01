"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MenuIcon, HeartPulseIcon, UserIcon, HomeIcon } from "@/components/icons";

const MENU_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/coach/profile", label: "Profile", icon: UserIcon },
  { href: "/progress", label: "Progress", icon: HeartPulseIcon },
] as const;

// Overflow menu for the flat Dashboard/Training/Nutrition/More nav
// (2026-08-25 redesign, Coach replaced by More 2026-09-01 once Pod Coach
// became a floating bubble instead of a dedicated tab — see
// member-bottom-nav.tsx). This is the *premium* side's More only —
// non-premium pages don't have this menu at all any more (Health/
// Leaderboard live in Profile's Activity section instead, always
// reachable via the universal bottom nav; see profile-view.tsx). Was
// previously also a standalone circular icon-button rendered on several
// non-premium pages' headers; that variant and every one of those call
// sites is gone as of the same change, so this only ever renders as the
// 4th flat bottom-nav tab now — dropdown opens upward, a bottom-anchored
// tab's panel would render off-screen below the viewport otherwise.
export function MoreMenu({ active = false }: { active?: boolean }) {
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
    <div ref={containerRef} className="relative flex flex-1">
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
      {open && (
        <div className="absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-card-border bg-card shadow-lg">
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
