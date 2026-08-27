"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/data/member";
import { LockIcon } from "@/components/icons";
import { UNLOCK_WINDOW_BEFORE_MS, unlockWindowAfterMs } from "@/lib/unlock-window";

function formatSlot(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/London" }) +
    " at " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
  );
}

export function UpcomingSessionCard({
  booking,
  accessComplete,
  slotDurationMinutes,
}: {
  booking: Booking;
  accessComplete: boolean;
  slotDurationMinutes: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState("");

  const start = new Date(booking.slot_start).getTime();
  const inUnlockWindow = now >= start - UNLOCK_WINDOW_BEFORE_MS && now <= start + unlockWindowAfterMs(slotDurationMinutes);

  async function unlock() {
    setMessage("");
    setUnlocking(true);
    try {
      let position: GeolocationPosition;
      try {
        position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported"));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
      } catch {
        setMessage("Turn on location services to unlock the door.");
        return;
      }

      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });
      const body = await res.json();
      setMessage(body.status === "ok" ? "Unlocked — door should open now." : body.message);
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="card-light p-5 text-center">
      <p className="text-base font-semibold">Upcoming session</p>
      <p className="mt-1 text-sm text-card-light-muted">{formatSlot(booking.slot_start)}</p>

      {!accessComplete ? (
        <Link
          href="/access"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
        >
          <LockIcon className="h-4 w-4" />
          Complete Access
        </Link>
      ) : inUnlockWindow ? (
        <button
          onClick={unlock}
          disabled={unlocking}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-card-light-foreground px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <LockIcon className="h-4 w-4" />
          {unlocking ? "Unlocking..." : "Access"}
        </button>
      ) : (
        <Link
          href="/bookings"
          className="mt-3 inline-block rounded-lg border border-card-light-border px-4 py-2 text-sm font-semibold text-card-light-foreground hover:bg-card-light-foreground hover:text-white"
        >
          Access
        </Link>
      )}

      {message && <p className="mt-2 text-xs text-card-light-muted">{message}</p>}
      {accessComplete && !inUnlockWindow && (
        <p className="mt-2 text-xs text-card-light-muted">Unlock opens 5 minutes before your session.</p>
      )}
    </div>
  );
}
