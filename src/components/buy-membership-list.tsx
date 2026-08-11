"use client";

import { useState } from "react";
import Link from "next/link";
import type { MembershipTier } from "@/lib/membership-tiers";

export function BuyMembershipList({ tiers }: { tiers: MembershipTier[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(tierId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(tierId);
    try {
      const res = await fetch("/api/checkout-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const body = await res.json();
      if (body.status !== "ok" || !body.url) {
        setError(body.message ?? "Could not start checkout.");
        setPendingId(null);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Something went wrong. Try again.");
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-danger">{error}</p>}
      {tiers.map((tier) => (
        <div key={tier.id} className="flex items-center justify-between rounded-xl border border-card-light-border p-5">
          <div>
            <p className="text-base font-semibold">{tier.name}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-card-light-foreground">
              £{tier.priceGBP.toFixed(2)}
              <span className="text-sm font-normal text-card-light-muted"> / month</span>
            </p>
            <p className="text-sm text-card-light-muted">{tier.label}</p>
          </div>
          <button
            onClick={() => buy(tier.id)}
            disabled={!!pendingId}
            className="rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pendingId === tier.id ? "Redirecting..." : "Subscribe"}
          </button>
        </div>
      ))}
      <Link href="/book" className="mt-2 inline-block text-sm text-card-light-muted hover:text-card-light-foreground">
        Back to booking
      </Link>
    </div>
  );
}
