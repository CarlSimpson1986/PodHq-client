"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, DumbbellIcon, ShopIcon, UserIcon, DownloadIcon, SparkleIcon } from "@/components/icons";
import { useInstallPrompt } from "@/lib/use-install-prompt";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon, tourId: undefined },
  { href: "/book", label: "Book", icon: DumbbellIcon, tourId: "tour-nav-book" },
  { href: "/coach", label: "Coach", icon: SparkleIcon, tourId: "tour-nav-coach" },
  { href: "/shop", label: "Shop", icon: ShopIcon, tourId: "tour-nav-shop" },
  { href: "/profile", label: "Profile", icon: UserIcon, tourId: "tour-nav-profile" },
];

// Fixed at the bottom of every member-facing page (Home/Book/Coach/Shop/
// Profile), matching GymFlow's own tab bar (Coach added Stage 5 — the
// brief's original nav spec always had 5 tabs; Stages 1-4 used a card on
// Home since there was nothing to link a whole tab to yet). Not shown on
// the auth pages (login/signup/forgot-password) or the buy-credits/
// buy-membership/gift-voucher sub-pages reached *through* Shop, or the
// coach-onboarding/workout sub-pages reached *through* Coach — those keep
// the "Back to booking"-style link pattern instead, same as GymFlow's own
// sub-screens don't repeat the tab bar's exact highlighted state for a
// screen that isn't one of the 5 tabs.
export function BottomNav() {
  const pathname = usePathname();
  const { installable, ios, promptInstall } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  function handleInstallClick() {
    if (ios) {
      setShowIosHint((v) => !v);
      return;
    }
    promptInstall();
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-card-border bg-card">
      {showIosHint && (
        <div className="mx-auto max-w-md px-4 pb-2 pt-3 text-center text-xs text-muted-foreground">
          Tap the Share icon, then &quot;Add to Home Screen&quot; for quick access, even with poor signal at the gym.
        </div>
      )}
      <div className="mx-auto flex w-full max-w-md items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              id={item.tourId}
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
        {installable && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground"
          >
            <DownloadIcon className="h-6 w-6" />
            Install
          </button>
        )}
      </div>
    </nav>
  );
}
