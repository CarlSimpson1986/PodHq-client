"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/data/member";
import { CalendarIcon, LockIcon } from "@/components/icons";

const WINDOW_BEFORE_MS = 5 * 60 * 1000;
const WINDOW_AFTER_MS = 65 * 60 * 1000; // 1hr slot + 5min grace

function hourSlots(): Date[] {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return Array.from({ length: 24 }, (_, hour) => {
    const d = new Date(startOfDay);
    d.setHours(hour);
    return d;
  });
}

function formatHour(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function BookingGrid({
  gym,
  memberName,
  memberId,
  initialCredits,
  initialBookings,
  purchaseSuccess,
}: {
  gym: string;
  memberName: string;
  memberId: number;
  initialCredits: number;
  initialBookings: Booking[];
  purchaseSuccess: boolean;
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [credits, setCredits] = useState(initialCredits);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);

  async function bookSlot(slot: Date) {
    // Guards against any request being in flight, not just this slot's own —
    // a rapid double/triple click can fire multiple click events before
    // React re-renders the disabled state on the button that was actually
    // clicked, so per-slot pendingSlot alone isn't a tight enough guard.
    if (pendingSlot) return;
    setError(null);
    setSuccess(null);
    setPendingSlot(slot.toISOString());
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotStart: slot.toISOString() }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Could not book that slot.");
        return;
      }
      setBookings((prev) => [
        ...prev,
        { id: body.bookingId, member_id: memberId, gym, slot_start: slot.toISOString(), status: "booked" },
      ]);
      setCredits((prev) => prev - 1);
      setSuccess(`Booked ${formatHour(slot)} — 1 credit used.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPendingSlot(null);
    }
  }

  async function unlock() {
    setUnlockMessage(null);
    setUnlocking(true);
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
        setUnlockMessage("Turn on location services to unlock the door.");
        return;
      }

      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });
      const body = await res.json();
      setUnlockMessage(body.status === "ok" ? "Unlocked — door should open now." : body.message);
    } catch {
      setUnlockMessage("Something went wrong. Try again.");
    } finally {
      setUnlocking(false);
    }
  }

  const now = Date.now();
  // Past slots that aren't the member's own booking are hidden rather than
  // shown greyed-out — a flat 24-row list meant scrolling past 10+ dead
  // "Past" rows every time to reach anything bookable, real friction on
  // every single visit. A past slot that IS the member's own stays visible
  // (still relevant briefly after a booking, e.g. mid-unlock-window).
  const slots = hourSlots().filter((slot) => {
    const isPast = slot.getTime() + 60 * 60 * 1000 < now;
    if (!isPast) return true;
    return bookings.some((b) => new Date(b.slot_start).getTime() === slot.getTime() && b.member_id === memberId);
  });

  return (
    <>
      <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{gym}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Hi {memberName}</p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border text-foreground">
            <CalendarIcon className="h-7 w-7" />
          </div>
        </div>
        <div className="mx-auto mt-6 flex w-full max-w-md items-center justify-between rounded-xl border border-card-border px-4 py-3">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{credits}</p>
            <p className="text-xs text-muted-foreground">credits available</p>
          </div>
          <Link
            href="/buy-credits"
            className="rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground hover:text-background"
          >
            Buy more
          </Link>
        </div>
      </div>

      <div className="card-light flex-1 space-y-3 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-3">
          {purchaseSuccess && <p className="text-sm text-success">Payment received — credits added.</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
          {slots.map((slot) => {
            const existing = bookings.find((b) => new Date(b.slot_start).getTime() === slot.getTime());
            const isMine = existing?.member_id === memberId;
            const isTaken = !!existing && !isMine;
            const inUnlockWindow =
              isMine && now >= slot.getTime() - WINDOW_BEFORE_MS && now <= slot.getTime() + WINDOW_AFTER_MS;

            return (
              <div
                key={slot.toISOString()}
                className="flex items-center justify-between rounded-xl border border-card-light-border p-4"
              >
                <span className="text-base font-medium tabular-nums">{formatHour(slot)}</span>

                {isMine ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-card-light-foreground">Your booking</span>
                      {inUnlockWindow && (
                        <button
                          onClick={unlock}
                          disabled={unlocking}
                          className="flex items-center gap-1.5 rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <LockIcon className="h-4 w-4" />
                          {unlocking ? "Unlocking..." : "Unlock"}
                        </button>
                      )}
                    </div>
                    {inUnlockWindow && unlockMessage && (
                      <p className="text-xs text-card-light-muted">{unlockMessage}</p>
                    )}
                  </div>
                ) : isTaken ? (
                  <span className="text-sm text-card-light-muted">Booked</span>
                ) : (
                  <button
                    onClick={() => bookSlot(slot)}
                    disabled={!!pendingSlot}
                    className="rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white disabled:opacity-50"
                  >
                    {pendingSlot === slot.toISOString() ? "Booking..." : "Book"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
