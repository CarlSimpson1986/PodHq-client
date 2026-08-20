"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreditPackage } from "@/lib/credit-packages";

type PackageWithClaimStatus = CreditPackage & { alreadyClaimed: boolean };

export function BuyCreditsList({ packages }: { packages: PackageWithClaimStatus[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  async function buy(packageId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(packageId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}) }),
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
      <div>
        <label className="mb-1 block text-xs font-medium text-card-light-muted">Have a coupon code?</label>
        <input
          type="text"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="Enter code"
          className="w-full rounded-lg border border-card-light-border px-3 py-2 text-sm uppercase text-card-light-foreground placeholder:normal-case placeholder:text-card-light-muted"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {packages.map((pkg) => (
        <div key={pkg.id} className="flex items-center justify-between rounded-xl border border-card-light-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold">{pkg.name}</p>
              {pkg.oneTimePerMember && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">One-time offer</span>
              )}
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums text-card-light-foreground">
              £{pkg.priceGBP.toFixed(2)}
            </p>
            <p className="text-sm text-card-light-muted">{pkg.label}</p>
            {pkg.alreadyClaimed && <p className="mt-1 text-sm text-card-light-muted">Already claimed — limited to one per member.</p>}
          </div>
          <button
            onClick={() => buy(pkg.id)}
            disabled={!!pendingId || pkg.alreadyClaimed}
            className="rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pkg.alreadyClaimed ? "Claimed" : pendingId === pkg.id ? "Redirecting..." : "Buy"}
          </button>
        </div>
      ))}
      <Link href="/book" className="mt-2 inline-block text-sm text-card-light-muted hover:text-card-light-foreground">
        Back to booking
      </Link>
    </div>
  );
}
