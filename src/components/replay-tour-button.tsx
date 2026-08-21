"use client";

import { useRouter } from "next/navigation";

// The tour's steps target home-screen elements only (see onboarding-tour.tsx),
// so replaying it from elsewhere navigates home first and asks it to
// force-launch there via a query param, rather than trying to run it here.
export function ReplayTourButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/?tour=replay")}
      className="w-full rounded-xl border border-card-light-border p-4 text-left text-sm font-semibold hover:bg-card-light-foreground hover:text-white"
    >
      Replay app tour
    </button>
  );
}
