"use client";

import { useState } from "react";
import Link from "next/link";
import type { CreditPackage } from "@/lib/credit-packages";

export function BuyCreditsList({ packages }: { packages: CreditPackage[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packageId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(packageId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
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
      {packages.map((pkg) => (
        <div key={pkg.id} className="flex items-center justify-between rounded-xl border border-card-light-border p-5">
          <div>
            <p className="text-base font-semibold">{pkg.name}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-card-light-foreground">
              £{pkg.priceGBP.toFixed(2)}
            </p>
            <p className="text-sm text-card-light-muted">{pkg.label}</p>
          </div>
          <button
            onClick={() => buy(pkg.id)}
            disabled={!!pendingId}
            className="rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pendingId === pkg.id ? "Redirecting..." : "Buy"}
          </button>
        </div>
      ))}
      <Link href="/book" className="mt-2 inline-block text-sm text-card-light-muted hover:text-card-light-foreground">
        Back to booking
      </Link>
    </div>
  );
}
