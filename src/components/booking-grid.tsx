"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/data/member";

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
}: {
  gym: string;
  memberName: string;
  memberId: number;
  initialCredits: number;
  initialBookings: Booking[];
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
    <div className="space-y-2">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{gym}</h1>
          <p className="text-sm text-muted-foreground">Hi {memberName}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-accent">{credits}</p>
          <p className="text-xs text-muted-foreground">credits</p>
          <Link href="/buy-credits" className="text-xs text-accent hover:underline">
            Buy more
          </Link>
        </div>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}
      {slots.map((slot) => {
        const existing = bookings.find((b) => new Date(b.slot_start).getTime() === slot.getTime());
        const isMine = existing?.member_id === memberId;
        const isTaken = !!existing && !isMine;
        const inUnlockWindow =
          isMine && now >= slot.getTime() - WINDOW_BEFORE_MS && now <= slot.getTime() + WINDOW_AFTER_MS;

        return (
          <div key={slot.toISOString()} className="card-glass flex items-center justify-between p-3">
            <span className="text-sm tabular-nums">{formatHour(slot)}</span>

            {isMine ? (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-accent">Your booking</span>
                  {inUnlockWindow && (
                    <button
                      onClick={unlock}
                      disabled={unlocking}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
                    >
                      {unlocking ? "Unlocking..." : "Unlock"}
                    </button>
                  )}
                </div>
                {inUnlockWindow && unlockMessage && (
                  <p className="text-xs text-accent">{unlockMessage}</p>
                )}
              </div>
            ) : isTaken ? (
              <span className="text-xs text-muted-foreground">Booked</span>
            ) : (
              <button
                onClick={() => bookSlot(slot)}
                disabled={!!pendingSlot}
                className="rounded-md border border-card-border px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {pendingSlot === slot.toISOString() ? "Booking..." : "Book"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
