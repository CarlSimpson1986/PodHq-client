"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MembershipTier } from "@/lib/membership-tiers";

// Derived, not stored — same categorization podHq's Setup catalog table
// uses (src/components/setup/catalog-view.tsx). Combo tiers (secondary
// set) group separately regardless of their primary credit type.
const CATEGORY_ORDER = ["Gym", "Recovery Room", "Combination"] as const;
function categoryFor(tier: MembershipTier): (typeof CATEGORY_ORDER)[number] {
  if (tier.creditTypeSecondary) return "Combination";
  if (tier.creditType === "recovery") return "Recovery Room";
  return "Gym";
}

export function BuyMembershipList({
  tiers,
  currentTierId,
}: {
  tiers: MembershipTier[];
  currentTierId: string | null;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => CATEGORY_ORDER.filter((cat) => tiers.some((t) => categoryFor(t) === cat)), [tiers]);
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORY_ORDER)[number] | null>(categories[0] ?? null);
  const visibleTiers = selectedCategory ? tiers.filter((t) => categoryFor(t) === selectedCategory) : tiers;

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
      {currentTierId && (
        <p className="text-sm text-card-light-muted">
          Switching plans cancels your current plan immediately (no partial refund for the unused period) and starts
          the new one.
        </p>
      )}
      {categories.length > 1 && (
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={
                selectedCategory === cat
                  ? "rounded-lg bg-card-light-foreground px-3 py-1.5 text-sm font-semibold text-white"
                  : "rounded-lg border border-card-light-border px-3 py-1.5 text-sm text-card-light-muted hover:text-card-light-foreground"
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      {visibleTiers.map((tier) => {
        const isCurrent = tier.id === currentTierId;
        return (
          <div key={tier.id} className="flex items-center justify-between rounded-xl border border-card-light-border p-5">
            <div>
              <p className="text-base font-semibold">{tier.name}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-card-light-foreground">
                £{tier.priceGBP.toFixed(2)}
                <span className="text-sm font-normal text-card-light-muted"> / month</span>
              </p>
              <p className="text-sm text-card-light-muted">{tier.label}</p>
            </div>
            {isCurrent ? (
              <span className="rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-muted">
                Current plan
              </span>
            ) : (
              <button
                onClick={() => buy(tier.id)}
                disabled={!!pendingId}
                className="rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {pendingId === tier.id ? "Redirecting..." : currentTierId ? "Switch to this plan" : "Subscribe"}
              </button>
            )}
          </div>
        );
      })}
      <Link href="/book" className="mt-2 inline-block text-sm text-card-light-muted hover:text-card-light-foreground">
        Back to booking
      </Link>
    </div>
  );
}
