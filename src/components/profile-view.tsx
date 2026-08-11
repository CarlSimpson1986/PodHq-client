"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Membership, CreditHistoryRow } from "@/lib/data/member";
import { BottomNav } from "@/components/bottom-nav";

const REASON_LABELS: Record<CreditHistoryRow["reason"], string> = {
  manual_grant: "Manual grant",
  booking_used: "Booking",
  booking_refund: "Booking refund",
  purchase: "Credit pack purchase",
  membership: "Membership renewal",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ProfileView({
  memberName,
  gym,
  membership,
  creditHistory,
}: {
  memberName: string;
  gym: string;
  membership: Membership | null;
  creditHistory: CreditHistoryRow[];
}) {
  const router = useRouter();
  const [membershipState, setMembershipState] = useState(membership);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function cancelMembership() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/membership/cancel", { method: "POST" });
      const body = await res.json();
      if (body.status !== "ok") {
        setCancelError(body.message ?? "Could not cancel membership.");
        return;
      }
      // Optimistic — the webhook is the real source of truth and updates
      // the DB row shortly after, but there's no reason to make the member
      // wait here for something Stripe has already confirmed.
      setMembershipState(null);
    } catch {
      setCancelError("Something went wrong. Try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-semibold text-foreground">{memberName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{gym}</p>
        </div>
      </div>

      <div className="card-light flex-1 space-y-6 px-6 pb-24 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-card-light-muted">Membership</h2>
            {membershipState ? (
              <div className="mt-2 rounded-xl border border-card-light-border p-4">
                <p className="text-base font-semibold">{membershipState.tier_name}</p>
                <p className="mt-1 text-sm text-card-light-muted">
                  {membershipState.credits_per_period} credits / month
                  {membershipState.current_period_end &&
                    ` — renews ${formatDate(membershipState.current_period_end)}`}
                </p>
                {cancelError && <p className="mt-2 text-sm text-danger">{cancelError}</p>}
                <button
                  onClick={cancelMembership}
                  disabled={cancelling}
                  className="mt-3 rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel membership"}
                </button>
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-card-light-border p-4">
                <p className="text-sm text-card-light-muted">No active membership.</p>
                <Link
                  href="/buy-membership"
                  className="mt-2 inline-block text-sm font-semibold text-card-light-foreground underline"
                >
                  Get a membership
                </Link>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-card-light-muted">Credit history</h2>
            {creditHistory.length === 0 ? (
              <p className="mt-2 text-sm text-card-light-muted">No activity yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {creditHistory.map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border border-card-light-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{REASON_LABELS[row.reason]}</p>
                      <p className="text-xs text-card-light-muted">{formatDate(row.created_at)}</p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${row.amount >= 0 ? "text-success" : "text-card-light-muted"}`}>
                      {row.amount >= 0 ? `+${row.amount}` : row.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button
            onClick={logout}
            disabled={loggingOut}
            className="w-full rounded-lg border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
          >
            {loggingOut ? "Logging out..." : "Log out"}
          </button>

          <Link href="/book" className="block text-center text-sm text-card-light-muted hover:text-card-light-foreground">
            Back to booking
          </Link>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
