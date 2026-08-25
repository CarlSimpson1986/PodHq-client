"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparkleIcon, DumbbellIcon, AppleIcon, HeartPulseIcon } from "@/components/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: SparkleIcon },
  { href: "/training", label: "Training", icon: DumbbellIcon },
  { href: "/nutrition", label: "Nutrition", icon: AppleIcon },
  { href: "/health", label: "Health", icon: HeartPulseIcon },
] as const;

// Replaces CoachBottomNav — flat 4-tab IA (2026-08-25 redesign), no
// Exit/Profile items: these routes now sit at the top level (same tier as
// /book, /shop), so there's nothing to "exit" back out of, and Profile
// settings move to the Dashboard header's settings icon instead of a nav
// tab. Coach chat (formerly the "Dashboard" item here) is reached from a
// card on /dashboard, not a tab — matches the design brief's IA.
export function MemberBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-card-border bg-card">
      <div className="mx-auto flex w-full max-w-md items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
