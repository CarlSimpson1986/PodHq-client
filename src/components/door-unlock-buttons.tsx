"use client";

import { useState } from "react";
import { LockIcon } from "@/components/icons";

type Door = "entrance" | "room";

// For a booking behind a shared main door (Hove, podHq 0105): two
// separate, always-visible buttons in walking order — main door, then the
// room's own. Carl's call 2026-10-04, over one button that switches to the
// next door after a tap: at an unmanned site a member must only ever need
// to know which door they're standing at. A guessed "next door" goes wrong
// exactly when it matters — a relocked main door, a timed-out reply that
// actually opened, or popping out to the car mid-session. Single-door
// resources keep their existing one-button flow and never render this.
export function DoorUnlockButtons({
  bookingId,
  roomLabel,
  requiresLocation,
  onRoomUnlocked,
}: {
  bookingId: number;
  roomLabel: string;
  requiresLocation: boolean;
  onRoomUnlocked: () => void;
}) {
  const [unlocking, setUnlocking] = useState<Door | null>(null);
  const [messages, setMessages] = useState<Record<Door, string>>({ entrance: "", room: "" });

  async function unlock(door: Door) {
    setMessages((prev) => ({ ...prev, [door]: "" }));
    setUnlocking(door);
    try {
      // Same GPS rule as the single-door buttons: only ask when the
      // server will actually check it.
      let position: GeolocationPosition | null = null;
      if (requiresLocation) {
        try {
          position = await new Promise<GeolocationPosition>((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error("Geolocation not supported"));
              return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 });
          });
        } catch {
          position = null;
        }
      }

      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          door,
          ...(position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : {}),
        }),
      });
      const body = await res.json();
      setMessages((prev) => ({ ...prev, [door]: body.status === "ok" ? "Unlocked — door should open now." : body.message }));
      // Only the room door moves on to the workout — after the main door
      // the member still needs this screen for the next one.
      if (body.status === "ok" && door === "room") {
        setTimeout(onRoomUnlocked, 900);
      }
    } catch {
      setMessages((prev) => ({ ...prev, [door]: "Something went wrong. Try again." }));
    } finally {
      setUnlocking(null);
    }
  }

  const doors: { door: Door; label: string }[] = [
    { door: "entrance", label: "Open main door" },
    { door: "room", label: `Open ${roomLabel.toLowerCase()} door` },
  ];

  return (
    <div className="mt-3 space-y-2">
      {doors.map(({ door, label }) => (
        <div key={door}>
          <button
            onClick={() => unlock(door)}
            disabled={unlocking !== null}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-card-light-foreground px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <LockIcon className="h-4 w-4" />
            {unlocking === door ? "Unlocking..." : label}
          </button>
          {messages[door] && <p className="mt-1 text-center text-xs text-card-light-muted">{messages[door]}</p>}
        </div>
      ))}
    </div>
  );
}
