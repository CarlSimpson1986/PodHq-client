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

// Overflow menu for the flat Dashboard/Training/Nutrition/Coach nav
// (2026-08-25 redesign) — Health stopped being a primary tab ("the
// Health tab still seems a bit pointless", Carl) in favour of a merged
// Coach tab (check-in + chat + weekly recommendation); the wearable/
// recovery integration still needs a home, so it moved here alongside
// Profile and a direct way back to the main app's booking area, which
// nothing in this section otherwise links to.
export function MoreMenu() {
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More"
        aria-expanded={open}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border text-foreground hover:bg-card-border"
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      {open && (
        <div className="absolute right-0 top-16 z-20 w-48 overflow-hidden rounded-xl border border-card-border bg-card shadow-lg">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
