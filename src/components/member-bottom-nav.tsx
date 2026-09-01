"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparkleIcon, DumbbellIcon, AppleIcon } from "@/components/icons";
import { MoreMenu } from "@/components/more-menu";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: SparkleIcon },
  { href: "/training", label: "Training", icon: DumbbellIcon },
  { href: "/nutrition", label: "Nutrition", icon: AppleIcon },
] as const;

// Paths MoreMenu's own dropdown links to (see more-menu.tsx's MENU_ITEMS)
// that should count as "More" being active — excludes "/" (Home), since
// every path starts with "/" and would make the tab permanently active.
const MORE_ACTIVE_PREFIXES = ["/progress", "/coach"];

// Replaces CoachBottomNav — flat 4-tab IA (2026-08-25 redesign), no
// Exit/Profile items: these routes now sit at the top level (same tier as
// /book, /shop), so there's nothing to "exit" back out of. Health
// stopped being a primary tab the same day, later on — Carl felt it was
// "a bit pointless" as a standalone destination — and moved into the
// MoreMenu overflow instead.
//
// Coach replaced by More (2026-09-01): Pod Coach became a floating bubble
// (chat + check-in) shown across these three pages instead of owning a
// tab/route of its own — see whichever component renders the bubble.
// coach/profile's settings content now lives behind More instead.
//
// prefetch={false} (2026-08-25, fixing Carl's "lots of lags" report): every
// one of these routes is a fully dynamic page doing several Supabase
// queries server-side, so Next's default viewport-triggered prefetch was
// firing all 4 pages' worth of DB queries in the background on every nav
// render — confirmed via live network capture, including a 503 on a real
// navigation competing with the prefetch storm for serverless concurrency.
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
              prefetch={false}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-6 w-6" />
              {item.label}
            </Link>
          );
        })}
        <MoreMenu active={MORE_ACTIVE_PREFIXES.some((p) => pathname.startsWith(p))} />
      </div>
    </nav>
  );
}
