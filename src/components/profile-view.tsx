"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Membership, CreditHistoryRow } from "@/lib/data/member";
import { BottomNav } from "@/components/bottom-nav";
import { CoinIcon, IdCardIcon, GiftIcon, DumbbellIcon, ChevronRightIcon, LogoutIcon, PinIcon } from "@/components/icons";

const REASON_LABELS: Record<CreditHistoryRow["reason"], string> = {
  manual_grant: "Manual grant",
  booking_used: "Booking",
  booking_refund: "Booking refund",
  purchase: "Credit pack purchase",
  membership: "Membership renewal",
  gift_voucher: "Gift voucher redeemed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// First letter of the first and last words — "Pilot Test Member" -> "PM",
// "Carl Simpson" -> "CS", a single word -> just that letter. Matches
// GymFlow's own initials-avatar treatment on its Profile screen.
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function ListRow({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-card-light-border px-4 py-3.5 last:border-b-0 hover:bg-card-border/10"
    >
      <Icon className="h-5 w-5 shrink-0 text-card-light-muted" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-card-light-muted" />
    </Link>
  );
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
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
        </div>
      </div>

      <div className="card-light flex-1 space-y-6 px-6 pb-24 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="flex items-center gap-4 rounded-xl border border-card-light-border p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-light-border text-lg font-semibold">
              {initials(memberName)}
            </div>
            <div>
              <p className="text-base font-semibold">{memberName}</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-card-light-muted">
                <PinIcon className="h-3.5 w-3.5" />
                {gym}
              </p>
            </div>
          </div>

          {membershipState ? (
            <div className="rounded-xl border border-card-light-border p-4">
              <p className="text-base font-semibold">{membershipState.tier_name}</p>
              <p className="mt-1 text-sm text-card-light-muted">
                {membershipState.credits_per_period} credits / month
                {membershipState.current_period_end && ` — renews ${formatDate(membershipState.current_period_end)}`}
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
            <div className="rounded-xl border-2 border-card-light-foreground p-5">
              <p className="text-base font-semibold">Get Your Membership</p>
              <p className="mt-1 text-sm text-card-light-muted">Get started with a monthly credit allowance.</p>
              <Link
                href="/buy-membership"
                className="mt-3 inline-block rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Get Membership
              </Link>
            </div>
          )}

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Account</h2>
            <div className="rounded-xl border border-card-light-border">
              <ListRow href="/buy-membership" label="Memberships" icon={IdCardIcon} />
              <ListRow href="/buy-credits" label="Credit Packs" icon={CoinIcon} />
              <ListRow href="/gift-voucher" label="Gift Voucher" icon={GiftIcon} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Booking</h2>
            <div className="rounded-xl border border-card-light-border">
              <ListRow href="/book" label="Bookings" icon={DumbbellIcon} />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-card-light-muted">Activity</h2>
            {creditHistory.length === 0 ? (
              <p className="text-sm text-card-light-muted">No activity yet.</p>
            ) : (
              <div className="space-y-2">
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
            className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-danger hover:opacity-80 disabled:opacity-50"
          >
            <LogoutIcon className="h-4 w-4" />
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
