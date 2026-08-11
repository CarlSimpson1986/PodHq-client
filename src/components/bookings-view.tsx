"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/data/member";
import { formatDateParam } from "@/lib/booking-dates";
import { LockIcon } from "@/components/icons";

const STATUS_LABELS: Record<Booking["status"], string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const WINDOW_BEFORE_MS = 5 * 60 * 1000;
const WINDOW_AFTER_MS = 65 * 60 * 1000; // 1hr slot + 5min grace

function formatSlot(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function BookingsView({ bookings, accessComplete }: { bookings: Booking[]; accessComplete: boolean }) {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [unlockMessages, setUnlockMessages] = useState<Record<number, string>>({});

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

  const now = Date.now();
  // A booking stays "upcoming" through the end of its own unlock window
  // (65 min after the slot starts), not just until the slot's start time —
  // otherwise it flipped to "past" right as a member arrived to unlock it.
  // Cancelled/completed/no-show is never "upcoming" regardless of timing.
  const upcoming = bookings.filter(
    (b) => b.status === "booked" && new Date(b.slot_start).getTime() + WINDOW_AFTER_MS >= now
  );
  const past = bookings.filter(
    (b) => !(b.status === "booked" && new Date(b.slot_start).getTime() + WINDOW_AFTER_MS >= now)
  );

  const shown = view === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-4">
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
              view === "upcoming" && now >= start - WINDOW_BEFORE_MS && now <= start + WINDOW_AFTER_MS;
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
