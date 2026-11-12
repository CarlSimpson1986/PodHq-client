"use client";

import { useRouter, usePathname } from "next/navigation";
import { GYM_NAMES } from "@/lib/gym";

// Gym chooser for signed-out visitors browsing /buy-membership and
// /buy-credits (2026-11-12, Apple guideline 5.1.1(v): browsing products
// must not require an account). A signed-in member already has a home
// gym, so this is only rendered for guests.
export function GuestGymPicker({ gym }: { gym: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div>
      <label htmlFor="guest-gym" className="mb-1 block text-xs font-medium text-card-light-muted">
        Gym
      </label>
      <select
        id="guest-gym"
        value={gym}
        onChange={(e) => router.replace(`${pathname}?gym=${encodeURIComponent(e.target.value)}`)}
        className="w-full rounded-lg border border-card-light-border bg-white px-3 py-2 text-sm text-card-light-foreground"
      >
        {GYM_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
