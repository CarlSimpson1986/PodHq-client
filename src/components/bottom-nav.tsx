"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, DumbbellIcon, ShopIcon, UserIcon } from "@/components/icons";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/book", label: "Book", icon: DumbbellIcon },
  { href: "/shop", label: "Shop", icon: ShopIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

// Fixed at the bottom of every member-facing page (Home/Book/Shop/Profile),
// matching GymFlow's own tab bar. Not shown on the auth pages (login/signup/
// forgot-password) or the buy-credits/buy-membership/gift-voucher sub-pages
// reached *through* Shop — those keep the "Back to booking"-style link
// pattern instead, same as GymFlow's own sub-screens don't repeat the tab
// bar's exact highlighted state for a screen that isn't one of the 4 tabs.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-card-border bg-card">
      <div className="mx-auto flex w-full max-w-md items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
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
