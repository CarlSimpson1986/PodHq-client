"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Booking, PodResource } from "@/lib/data/member";
import { formatDateParam } from "@/lib/booking-dates";
import { LockIcon } from "@/components/icons";
import { subscribeToPush } from "@/lib/push/subscribe";
import { UNLOCK_WINDOW_BEFORE_MS, unlockWindowAfterMs } from "@/lib/unlock-window";

const STATUS_LABELS: Record<Booking["status"], string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

// Falls back to 60 (the previous flat assumption) only if a booking's
// resource somehow can't be found — should never happen in practice, but
// an unlock-window computation is exactly the wrong place to let a missing
// lookup silently become NaN.
function slotDurationFor(resources: PodResource[], resourceId: number): number {
  return resources.find((r) => r.id === resourceId)?.slotDurationMinutes ?? 60;
}

// Cancellation policy: cancel more than 2 hours before slot_start and the
// credit is refunded; inside that window it's forfeited. Mirrors the
// server-side cutoff in cancel_booking() — this is just a hint shown
// before confirming, the DB function is the real enforcement.
const CANCELLATION_CUTOFF_MS = 2 * 60 * 60 * 1000;

// Notification.permission has no native "changed" event to subscribe to —
// this only ever needs the current value, re-read on whatever render
// happens to occur next (e.g. after enableNotifications's own setSubscribing
// triggers one), so the subscribe half is a genuine no-op, not a missing
// feature.
const NOOP_SUBSCRIBE = () => () => {};

// timeZone pinned explicitly on both formatters — without it, this renders
// in whichever local timezone the executing environment happens to be in,
// and Vercel's serverless functions run in UTC internally regardless of
// region pin (the same root cause already documented and fixed for the
// self-service bookable-hours check — see podHq's ROADMAP Stage 15 — just
// never applied to this display formatting). Server (UTC) and a member's
// own browser (Europe/London, BST for half the year) would otherwise
// render genuinely different time strings for the same booking — a real
// hydration mismatch (React error #418) on every page listing bookings,
// found live 2026-08-17.
function formatSlot(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }),
  };
}

export function BookingsView({
  bookings,
  accessComplete,
  resources,
}: {
  bookings: Booking[];
  accessComplete: boolean;
  resources: PodResource[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [unlockMessages, setUnlockMessages] = useState<Record<number, string>>({});
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  // `now` as state rather than calling Date.now() directly during render —
  // a newer eslint-plugin-react-hooks (pulled in by the 2026-08-16
  // dependency upgrade) flags that as an impure-render error. Refreshed
  // every minute so the upcoming/past split doesn't go stale on a page left
  // open past a booking's window.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const [cancelledIds, setCancelledIds] = useState<Set<number>>(new Set());
  const [cancelErrors, setCancelErrors] = useState<Record<number, string>>({});
  // useSyncExternalStore, not a useState lazy initializer reading
  // Notification.permission directly — that looked SSR-safe but wasn't:
  // the initializer function still runs during React's render phase on
  // both server and client, and the server has no Notification global at
  // all, so the client's very first render (which must match the server's
  // or hydration fails) computed a real permission value against the
  // server's null. That's a genuine hydration mismatch (React error #418),
  // not a false alarm — found live 2026-08-17, silently crashing this
  // component's hydration and breaking every push-related feature on this
  // page regardless of any server-side config. useSyncExternalStore is
  // React's actual sanctioned tool for "a browser-only value that can
  // differ from the server snapshot" — its server snapshot is always null,
  // guaranteeing the first client render matches, then the real value
  // takes over immediately after hydration commits.
  const notifPermission = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => (typeof Notification !== "undefined" ? Notification.permission : null),
    () => null
  );
  const [subscribing, setSubscribing] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  // Browser permission and "we actually have a saved subscription" can
  // drift apart — e.g. VAPID keys missing server-side once meant every
  // subscribe attempt silently failed after the permission prompt already
  // succeeded, permanently hiding the banner below (permission stays
  // "granted" forever once decided) for anyone who'd hit that. If
  // permission is already granted, confirm a subscription actually exists
  // server-side and silently (re)subscribe if not — no prompt needed,
  // requestPermission() resolves immediately once already decided.
  useEffect(() => {
    if (notifPermission !== "granted") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/push/subscription-status");
        const body = await res.json();
        if (cancelled || body.status !== "ok" || body.subscribed) return;
        const result = await subscribeToPush();
        if (!cancelled && !result.ok) setNotifError(result.reason);
      } catch (err) {
        // Best-effort — next page load just retries.
        console.error("[push] subscription-status check failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notifPermission]);

  async function enableNotifications() {
    setSubscribing(true);
    setNotifError(null);
    const result = await subscribeToPush();
    // No manual permission re-read needed — setSubscribing below triggers a
    // re-render, and useSyncExternalStore picks up the now-current
    // Notification.permission value on its own.
    setSubscribing(false);
    if (!result.ok) setNotifError(result.reason);
  }

  async function confirmCancel(bookingId: number) {
    setCancellingId(bookingId);
    setCancelErrors((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setCancelErrors((prev) => ({ ...prev, [bookingId]: body.message ?? "Could not cancel booking." }));
        return;
      }
      // Optimistic — hides the booking from Upcoming immediately rather
      // than waiting on the server-component refetch below.
      setCancelledIds((prev) => new Set(prev).add(bookingId));
      setConfirmingCancelId(null);
      router.refresh();
    } catch {
      setCancelErrors((prev) => ({ ...prev, [bookingId]: "Something went wrong. Try again." }));
    } finally {
      setCancellingId(null);
    }
  }

  async function unlock(bookingId: number) {
    setUnlockMessages((prev) => ({ ...prev, [bookingId]: "" }));
    setUnlockingId(bookingId);
    try {
      // Matches GymFlow's own requirement for general door access — you
      // must be at the gym, with location on, to unlock. Requested here
      // (not skipped on failure) so the server sees a definite absence
      // rather than us silently omitting it.
      let position: GeolocationPosition | null = null;
      try {
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
      } catch {
        setUnlockMessages((prev) => ({ ...prev, [bookingId]: "Turn on location services to unlock the door." }));
        return;
      }

      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });
      const body = await res.json();
      setUnlockMessages((prev) => ({
        ...prev,
        [bookingId]: body.status === "ok" ? "Unlocked — door should open now." : body.message,
      }));
    } catch {
      setUnlockMessages((prev) => ({ ...prev, [bookingId]: "Something went wrong. Try again." }));
    } finally {
      setUnlockingId(null);
    }
  }

  // A booking stays "upcoming" through the end of its own unlock window
  // (slot duration + 5min grace after it starts), not just until the
  // slot's start time — otherwise it flipped to "past" right as a member
  // arrived to unlock it. Cancelled/completed/no-show is never "upcoming"
  // regardless of timing.
  const upcoming = bookings.filter(
    (b) =>
      b.status === "booked" &&
      !cancelledIds.has(b.id) &&
      new Date(b.slot_start).getTime() + unlockWindowAfterMs(slotDurationFor(resources, b.resource_id)) >= now
  );
  const past = bookings.filter(
    (b) =>
      !(
        b.status === "booked" &&
        new Date(b.slot_start).getTime() + unlockWindowAfterMs(slotDurationFor(resources, b.resource_id)) >= now
      )
  );

  const shown = view === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-4">
      {notifPermission === "default" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-card-light-border p-3">
          <p className="text-xs text-card-light-muted">Get notified the moment a waitlisted spot opens up.</p>
          <button
            onClick={enableNotifications}
            disabled={subscribing}
            className="shrink-0 rounded-lg border border-card-light-border px-3 py-1.5 text-xs font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
          >
            {subscribing ? "..." : "Enable notifications"}
          </button>
        </div>
      )}
      {notifError && (
        <p className="text-xs text-danger">Push notifications couldn&apos;t be set up: {notifError}</p>
      )}
      <div className="flex rounded-lg border border-card-light-border p-1">
        {(["upcoming", "past"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setView(option)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold capitalize ${
              view === option ? "bg-card-light-foreground text-white" : "text-card-light-muted"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-card-light-muted">
          {view === "upcoming" ? "No upcoming sessions." : "No past sessions yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((booking) => {
            const { day, time } = formatSlot(booking.slot_start);
            const start = new Date(booking.slot_start).getTime();
            const inUnlockWindow =
              view === "upcoming" &&
              now >= start - UNLOCK_WINDOW_BEFORE_MS &&
              now <= start + unlockWindowAfterMs(slotDurationFor(resources, booking.resource_id));
            const message = unlockMessages[booking.id];

            return (
              <div key={booking.id} className="rounded-xl border border-card-light-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/book?date=${formatDateParam(new Date(booking.slot_start))}`} className="min-w-0">
                    <p className="truncate text-sm font-semibold">{day}</p>
                    <p className="text-sm text-card-light-muted">{time}</p>
                  </Link>
                  {view === "past" && (
                    <span className="shrink-0 text-xs font-semibold text-card-light-muted">
                      {STATUS_LABELS[booking.status]}
                    </span>
                  )}
                  {inUnlockWindow &&
                    (accessComplete ? (
                      <button
                        onClick={() => unlock(booking.id)}
                        disabled={unlockingId === booking.id}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <LockIcon className="h-4 w-4" />
                        {unlockingId === booking.id ? "Unlocking..." : "Unlock"}
                      </button>
                    ) : (
                      <Link
                        href="/access"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
                      >
                        <LockIcon className="h-4 w-4" />
                        Complete Access
                      </Link>
                    ))}
                </div>
                {inUnlockWindow && message && <p className="mt-2 text-xs text-card-light-muted">{message}</p>}
                {view === "upcoming" && !inUnlockWindow && (
                  <p className="mt-2 text-xs text-card-light-muted">Unlock opens 5 minutes before your session.</p>
                )}

                {view === "upcoming" &&
                  (confirmingCancelId === booking.id ? (
                    <div className="mt-3 rounded-lg border border-card-light-border p-3">
                      <p className="text-xs text-card-light-muted">
                        {start - now > CANCELLATION_CUTOFF_MS
                          ? "This is more than 2 hours away, so your credit will be refunded."
                          : "This is within 2 hours of your session, so your credit will not be refunded — you'll lose it."}
                      </p>
                      {cancelErrors[booking.id] && (
                        <p className="mt-2 text-xs text-danger">{cancelErrors[booking.id]}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => confirmCancel(booking.id)}
                          disabled={cancellingId === booking.id}
                          className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {cancellingId === booking.id ? "Cancelling..." : "Confirm cancellation"}
                        </button>
                        <button
                          onClick={() => setConfirmingCancelId(null)}
                          disabled={cancellingId === booking.id}
                          className="rounded-lg border border-card-light-border px-3 py-1.5 text-xs font-semibold text-card-light-muted hover:text-card-light-foreground"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingCancelId(booking.id)}
                      className="mt-2 text-xs font-semibold text-card-light-muted hover:text-danger"
                    >
                      Cancel session
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      <Link href="/profile" className="block text-center text-sm text-card-light-muted hover:text-card-light-foreground">
        Back to profile
      </Link>
    </div>
  );
}
