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
    <div className="space-y-2">
      {error && <p className="text-sm text-danger">{error}</p>}
      {packages.map((pkg) => (
        <div key={pkg.id} className="card-glass flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-semibold">{pkg.label}</p>
            <p className="text-xs text-muted-foreground">£{pkg.priceGBP.toFixed(2)}</p>
          </div>
          <button
            onClick={() => buy(pkg.id)}
            disabled={!!pendingId}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {pendingId === pkg.id ? "Redirecting..." : "Buy"}
          </button>
        </div>
      ))}
      <Link href="/book" className="mt-2 inline-block text-xs text-muted-foreground hover:text-accent">
        Back to booking
      </Link>
    </div>
  );
}
