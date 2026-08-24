"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, SparkleIcon, UserIcon, DumbbellIcon, AppleIcon, HeartPulseIcon } from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "Exit", icon: ArrowLeftIcon },
  { href: "/coach", label: "Dashboard", icon: SparkleIcon },
  { href: "/coach/profile", label: "Profile", icon: UserIcon },
  { href: "/coach/training", label: "Training", icon: DumbbellIcon },
  { href: "/coach/health", label: "Health", icon: HeartPulseIcon },
  { href: "/coach/nutrition", label: "Nutrition", icon: AppleIcon },
];

// The Coach section's own nav bar — replaces the main BottomNav (Home/
// Book/Coach/Shop/Profile) entirely on every /coach/* page, rather than
// stacking Dashboard/Profile/Workout/Nutrition as sections on one long
// scrolling page. Carl's call (2026-08-23), after the dashboard-sections
// version (Stage 10a) started to feel like too much on one page once
// check-in and habits were going to add real content to it, not just
// placeholder cards — matches how content-heavy areas in apps like
// Strava/Whoop/MyFitnessPal get their own tab bar rather than one long
// page. The main app's own BottomNav has "Home" as its first item;
// this bar's first item is deliberately labelled "Exit" with a distinct
// icon, not "Home" — two nav bars both showing a "Home" tab with
// different meanings depending which one you're looking at was the real
// risk flagged before building this, not the second-bar pattern itself.
export function CoachBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-card-border bg-card">
      <div className="mx-auto flex w-full max-w-md items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/coach" ? pathname === "/coach" : pathname.startsWith(item.href);
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
