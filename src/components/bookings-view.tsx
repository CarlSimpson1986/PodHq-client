"use client";

import { useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/data/member";
import { formatDateParam } from "@/lib/booking-dates";

const STATUS_LABELS: Record<Booking["status"], string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function formatSlot(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function BookingsView({ bookings }: { bookings: Booking[] }) {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");

  const now = Date.now();
  // A cancelled/completed/no-show slot is never "upcoming" regardless of
  // its timestamp, and a still-"booked" slot stops being upcoming the
  // moment its time passes — same split GymFlow's own Bookings screen
  // implies with its Upcoming/Past selector.
  const upcoming = bookings.filter((b) => b.status === "booked" && new Date(b.slot_start).getTime() >= now);
  const past = bookings.filter((b) => !(b.status === "booked" && new Date(b.slot_start).getTime() >= now));

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
            return (
              <Link
                key={booking.id}
                href={`/book?date=${formatDateParam(new Date(booking.slot_start))}`}
                className="flex items-center justify-between rounded-xl border border-card-light-border p-4 hover:bg-card-border/10"
              >
                <div>
                  <p className="text-sm font-semibold">{day}</p>
                  <p className="text-sm text-card-light-muted">{time}</p>
                </div>
                {view === "past" && (
                  <span className="text-xs font-semibold text-card-light-muted">{STATUS_LABELS[booking.status]}</span>
                )}
              </Link>
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
