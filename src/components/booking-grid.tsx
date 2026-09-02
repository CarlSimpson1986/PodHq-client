"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Booking, ActiveReservation, MemberWaitlistSlot, PodResource } from "@/lib/data/member";
import { UserIcon } from "@/components/icons";
import { bookingWindowDates, formatDateParam } from "@/lib/booking-dates";
import { londonDateParts, londonHour, londonHourOf } from "@/lib/london-time";
import { UNLOCK_WINDOW_BEFORE_MS, unlockWindowAfterMs } from "@/lib/unlock-window";
import { BottomNav } from "@/components/bottom-nav";
import { PodAssistBubble } from "@/components/pod-assist-bubble";
import { TourContinuation } from "@/components/tour-continuation";
import { GYM_NAMES } from "@/lib/gym";

// Slots for a day at the resource's own duration — a 60-minute resource
// gets 24 hourly slots (00:00, 01:00, ...), a 30-minute one gets 48
// half-hourly slots (00:00, 00:30, 01:00, ...). Previously always hourly
// regardless of resource, which silently offered only half of Hove's
// Recovery Room's real capacity (a 30-min resource has twice as many
// bookable starts as a 60-min one) and misrepresented what "18:00" would
// actually book.
function slotsForDay(day: Date, durationMinutes: number): Date[] {
  const count = (24 * 60) / durationMinutes;
  return Array.from({ length: count }, (_, i) => {
    const totalMinutes = i * durationMinutes;
    return londonHour(day, Math.floor(totalMinutes / 60), totalMinutes % 60);
  });
}

// timeZone pinned on all three — see bookings-view.tsx's formatSlot for why
// (same hydration-mismatch bug, React error #418, found live 2026-08-17,
// and see london-time.ts for the deeper related issue this file also had:
// setHours()/getHours()/getDate() build and read Date objects in local
// system time, not just display strings — fixed by routing every such
// access in this file through london-time.ts's helpers instead).
function formatHour(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function formatDayHeading(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

function formatMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
}

export function BookingGrid({
  gym,
  homeGym,
  hasMembership,
  memberName,
  memberId,
  creditsByType,
  initialBookings,
  selectedDate,
  purchaseSuccess,
  membershipSuccess,
  resources,
  initialWaitlistSlots,
  reservations,
}: {
  gym: string;
  homeGym: string;
  hasMembership: boolean;
  memberName: string;
  memberId: number;
  creditsByType: Record<string, number>;
  initialBookings: Booking[];
  selectedDate: string;
  purchaseSuccess: boolean;
  membershipSuccess: boolean;
  resources: PodResource[];
  initialWaitlistSlots: MemberWaitlistSlot[];
  reservations: ActiveReservation[];
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const [creditBalances, setCreditBalances] = useState(creditsByType);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set alongside `error` specifically for an insufficient-credits failure
  // away from home — a plain error message left the member to work out
  // for themselves that a top-up would fix it and where to get one (Carl's
  // ask, 2026-08-26); this surfaces the fix right where the failure
  // happened instead.
  const [showTopUpPrompt, setShowTopUpPrompt] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [waitlistSlots, setWaitlistSlots] = useState<MemberWaitlistSlot[]>(initialWaitlistSlots);
  const [pendingWaitlistSlot, setPendingWaitlistSlot] = useState<string | null>(null);
  // Resource selector — a gym with exactly one resource never shows tabs
  // at all (see the render below), so this only ever matters once a gym
  // has more than one.
  const [resourceId, setResourceId] = useState<number | null>(resources[0]?.id ?? null);
  const resource = resources.find((r) => r.id === resourceId) ?? null;
  const credits = resource ? (creditBalances[resource.creditType] ?? 0) : 0;
  // `now` as state rather than calling Date.now() directly during render —
  // a newer eslint-plugin-react-hooks (pulled in by the 2026-08-16
  // dependency upgrade) flags that as an impure-render error. Refreshed
  // every minute so past-slot filtering doesn't go stale on a page left
  // open across an hour boundary.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const selectedDayRef = useRef<HTMLAnchorElement>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);
  // Touch/trackpad already scroll the strip natively via overflow-x-auto —
  // this only covers a plain mouse (no touchscreen, no trackpad swipe),
  // which otherwise had no way to reach day 30 once the scrollbar itself
  // was hidden. `moved` past a small threshold suppresses the click that
  // would otherwise fire on the day Link right after a drag.
  const dragState = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  function onDayStripPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = dayStripRef.current;
    if (!el) return;
    dragState.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  }

  function onDayStripPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = dayStripRef.current;
    if (!el || !dragState.current.down) return;
    const dx = e.clientX - dragState.current.startX;
    if (Math.abs(dx) > 3) dragState.current.moved = true;
    el.scrollLeft = dragState.current.startScroll - dx;
  }

  function onDayStripPointerUp() {
    dragState.current.down = false;
    // The click that follows a drag-release lands synchronously, before
    // this timeout fires, so onDayLinkClick still sees `moved: true` and
    // suppresses it. Deferring the reset (rather than only clearing it
    // inside that click handler) matters when the drag ends over the
    // strip's padding instead of a day pill — no click fires there to
    // consume the flag, so without this it would stay stale true and
    // wrongly swallow the next, unrelated click.
    setTimeout(() => {
      dragState.current.moved = false;
    }, 0);
  }

  function onDayLinkClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (dragState.current.moved) {
      e.preventDefault();
    }
  }

  // Landing directly on a date outside today's default view (e.g. from
  // Home's upcoming-booking link, or a bookmarked ?date= URL) would
  // otherwise leave the strip showing its unscrolled start with the real
  // selection off-screen — nothing visibly indicates you need to scroll to
  // find it. "center" rather than "nearest" so it's not just barely
  // visible at the very edge.
  useEffect(() => {
    selectedDayRef.current?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
  }, [selectedDate]);

  async function bookSlot(slot: Date) {
    // Guards against any request being in flight, not just this slot's own —
    // a rapid double/triple click can fire multiple click events before
    // React re-renders the disabled state on the button that was actually
    // clicked, so per-slot pendingSlot alone isn't a tight enough guard.
    if (pendingSlot || !resource) return;
    setError(null);
    setShowTopUpPrompt(false);
    setSuccess(null);
    setPendingSlot(slot.toISOString());
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, slotStart: slot.toISOString() }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Could not book that slot.");
        // Matches the exact message /api/bookings sends for
        // insufficient_credits specifically — not slot_full/slot_reserved/
        // duplicate, which a top-up wouldn't fix.
        setShowTopUpPrompt(body.message === "Not enough credits to book this slot." && gym !== homeGym);
        return;
      }
      setBookings((prev) => [
        ...prev,
        { id: body.bookingId, member_id: memberId, gym, resource_id: resource.id, slot_start: slot.toISOString(), status: "booked" },
      ]);
      setCreditBalances((prev) => ({ ...prev, [resource.creditType]: (prev[resource.creditType] ?? 0) - 1 }));
      setSuccess(`Booked ${formatHour(slot)} — 1 credit used.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPendingSlot(null);
    }
  }

  async function joinWaitlist(slot: Date) {
    if (pendingWaitlistSlot || !resource) return;
    setError(null);
    setSuccess(null);
    setPendingWaitlistSlot(slot.toISOString());
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: resource.id, slotStart: slot.toISOString() }),
      });
      const body = await res.json();
      if (body.status !== "ok") {
        setError(body.message ?? "Could not join the waitlist.");
        return;
      }
      setWaitlistSlots((prev) => [...prev, { slotStart: slot.toISOString(), resourceId: resource.id }]);
      setSuccess(`Added to the waitlist for ${formatHour(slot)}.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPendingWaitlistSlot(null);
    }
  }

  const router = useRouter();
  const windowDates = bookingWindowDates();
  const todayStr = formatDateParam(windowDates[0]);
  const isToday = selectedDate === todayStr;
  const selectedDayDate = windowDates.find((d) => formatDateParam(d) === selectedDate) ?? windowDates[0];
  // Carries the current gym selection through date navigation — otherwise
  // clicking a different day would silently drop a PAYG member back to
  // their home gym's view.
  const isVisiting = gym !== homeGym;
  function dayHref(dayStr: string) {
    const params = new URLSearchParams();
    if (dayStr !== todayStr) params.set("date", dayStr);
    if (isVisiting) params.set("gym", gym);
    const qs = params.toString();
    return qs ? `/book?${qs}` : "/book";
  }

  // Past slots that aren't the member's own booking are hidden rather than
  // shown greyed-out — a flat 24-row list meant scrolling past 10+ dead
  // "Past" rows every time to reach anything bookable, real friction on
  // every single visit. A past slot that IS the member's own stays visible
  // (still relevant briefly after a booking, e.g. mid-unlock-window). Only
  // applies when viewing today — every slot on a future day is, by
  // definition, still ahead of "now".
  const slots = resource
    ? slotsForDay(selectedDayDate, resource.slotDurationMinutes).filter((slot) => {
        const slotHour = londonHourOf(slot);
        if (slotHour < resource.openHour || slotHour >= resource.closeHour) return false;
        if (!isToday) return true;
        const isPast = slot.getTime() + resource.slotDurationMinutes * 60 * 1000 < now;
        if (!isPast) return true;
        return bookings.some(
          (b) => b.resource_id === resource.id && new Date(b.slot_start).getTime() === slot.getTime() && b.member_id === memberId
        );
      })
    : [];

  return (
    <>
      <div className="bg-card px-6 pb-8 pt-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{gym}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Hi {memberName}</p>
          </div>
          <Link
            href="/profile"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-card-border text-foreground hover:bg-card-border"
          >
            <UserIcon className="h-7 w-7" />
          </Link>
        </div>
        {/* Shown to every member (2026-08-26) — a membership member can now
            book away from home too, just only by spending a separate
            network top-up credit rather than their subscription credit
            (podHq's 0064_pod_network_credit.sql); create_booking() itself
            enforces that, this control doesn't need to know their
            membership status to decide whether to render at all. */}
        <div className="mx-auto mt-3 w-full max-w-md">
          <label htmlFor="gym-switcher" className="mb-1 block text-xs text-muted-foreground">
            Booking at
          </label>
          <select
            id="gym-switcher"
            value={gym}
            onChange={(e) => {
              const nextGym = e.target.value;
              router.push(nextGym === homeGym ? "/book" : `/book?gym=${encodeURIComponent(nextGym)}`);
            }}
            className="w-full rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-foreground"
          >
            {GYM_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
                {name === homeGym ? " (your gym)" : ""}
              </option>
            ))}
          </select>
          {hasMembership && isVisiting && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Away bookings spend a PAYG top-up credit, not your membership&apos;s monthly credits.
            </p>
          )}
        </div>
        <div className="mx-auto mt-6 flex w-full max-w-md items-center justify-between rounded-xl border border-card-border px-4 py-3">
          <div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">{credits}</p>
            <p className="text-xs text-muted-foreground">credits available</p>
          </div>
          <Link
            id="tour-book-credits"
            href={isVisiting ? `/buy-credits?gym=${encodeURIComponent(gym)}` : "/buy-credits"}
            className="rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground hover:text-background"
          >
            Buy more
          </Link>
        </div>
        <div className="mx-auto mt-3 w-full max-w-md">
          <Link href="/buy-membership" className="text-sm text-muted-foreground underline hover:text-foreground">
            Get a monthly membership instead
          </Link>
        </div>
        <p className="mx-auto mt-6 w-full max-w-md text-sm font-semibold text-muted-foreground">
          {formatMonthYear(selectedDayDate)}
        </p>
        <div
          id="tour-book-dates"
          ref={dayStripRef}
          onPointerDown={onDayStripPointerDown}
          onPointerMove={onDayStripPointerMove}
          onPointerUp={onDayStripPointerUp}
          onPointerLeave={onDayStripPointerUp}
          onPointerCancel={onDayStripPointerUp}
          className="scrollbar-hide mx-auto mt-2 flex w-full max-w-md cursor-grab gap-2 overflow-x-auto pb-1 active:cursor-grabbing"
        >
          {windowDates.map((day) => {
            const dayStr = formatDateParam(day);
            const isSelected = dayStr === selectedDate;
            return (
              <Link
                key={dayStr}
                ref={isSelected ? selectedDayRef : undefined}
                href={dayHref(dayStr)}
                onClick={onDayLinkClick}
                className={`flex shrink-0 select-none flex-col items-center rounded-lg px-3 py-2 text-center ${
                  isSelected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card-border"
                }`}
              >
                <span className="text-xs uppercase">
                  {day.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" })}
                </span>
                <span className="text-base font-semibold tabular-nums">{londonDateParts(day).day}</span>
              </Link>
            );
          })}
        </div>
        {/* A gym with exactly one resource shows nothing here — zero UI
            change for the only currently-live single-resource gym. Large,
            equal-width pill buttons rather than small text-links — this is
            which resource you're about to book, not a minor filter, so it
            needs to be impossible to miss at a glance. */}
        {resources.length > 1 && (
          <div className="mx-auto mt-4 flex w-full max-w-md gap-3">
            {resources.map((r) => (
              <button
                key={r.id}
                onClick={() => setResourceId(r.id)}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-colors ${
                  r.id === resourceId
                    ? "bg-foreground text-background"
                    : "border-2 border-card-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 px-6 pb-24 pt-8">
        <div id="tour-book-slots" className="mx-auto w-full max-w-md card-light space-y-3 p-6">
          <p className="text-sm font-semibold text-card-light-muted">{formatDayHeading(selectedDayDate)}</p>
          {purchaseSuccess && <p className="text-sm text-success">Payment received — credits added.</p>}
          {membershipSuccess && (
            <p className="text-sm text-success">Membership active — your monthly credits will land shortly.</p>
          )}
          {error && (
            <div className="text-sm text-danger">
              <p>{error}</p>
              {showTopUpPrompt && (
                <Link href={`/buy-credits?gym=${encodeURIComponent(gym)}`} className="mt-1 inline-block font-semibold underline">
                  Buy a top-up for {gym} →
                </Link>
              )}
            </div>
          )}
          {success && <p className="text-sm text-success">{success}</p>}
          {resources.length === 0 && (
            <p className="text-sm text-card-light-muted">
              {gym} doesn&apos;t have online booking set up yet — try another gym, or ask staff.
            </p>
          )}
          {slots.map((slot) => {
            const slotBookings = bookings.filter(
              (b) => b.resource_id === resource?.id && new Date(b.slot_start).getTime() === slot.getTime()
            );
            const isMine = slotBookings.some((b) => b.member_id === memberId);
            // Capacity is normally 1 (unchanged pilot default) — a gym
            // configured for more than one concurrent booking (podHq's
            // admin Pods page) just means "taken" now means "at capacity",
            // not "anyone at all has this slot".
            const podCapacity = resource?.podCapacity ?? 1;
            const isFull = !isMine && slotBookings.length >= podCapacity;
            const inUnlockWindow =
              isMine &&
              !!resource &&
              now >= slot.getTime() - UNLOCK_WINDOW_BEFORE_MS &&
              now <= slot.getTime() + unlockWindowAfterMs(resource.slotDurationMinutes);
            // A slot can have real physical space (not "full") but still be
            // off-limits to everyone except whoever it's currently offered
            // to on the waitlist — create_booking() enforces this server-side
            // regardless, this is just showing it honestly instead of a
            // clickable "Book" that would only actually work for one person.
            const reservation = reservations.find(
              (r) => r.resource_id === resource?.id && new Date(r.slot_start).getTime() === slot.getTime()
            );
            const isReservedForOther = !isMine && !isFull && reservation && reservation.member_id !== memberId;

            return (
              <div
                key={slot.toISOString()}
                className="flex items-center justify-between rounded-xl border border-card-light-border p-4"
              >
                <span className="text-base font-medium tabular-nums">{formatHour(slot)}</span>

                {isMine ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <Link href="/bookings" className="text-sm font-semibold text-card-light-foreground hover:underline">
                      Your booking
                    </Link>
                    {inUnlockWindow && (
                      <Link href="/bookings" className="text-xs text-card-light-muted underline hover:text-card-light-foreground">
                        Unlock from Bookings
                      </Link>
                    )}
                  </div>
                ) : isFull ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-sm text-card-light-muted">
                      {podCapacity > 1 ? `Full (${slotBookings.length}/${podCapacity})` : "Booked"}
                    </span>
                    {waitlistSlots.some((w) => w.resourceId === resource?.id && w.slotStart === slot.toISOString()) ? (
                      <span className="text-xs text-card-light-muted">On waitlist</span>
                    ) : (
                      <button
                        onClick={() => joinWaitlist(slot)}
                        disabled={!!pendingWaitlistSlot}
                        className="text-xs font-semibold text-card-light-foreground underline hover:no-underline disabled:opacity-50"
                      >
                        {pendingWaitlistSlot === slot.toISOString() ? "Joining..." : "Join waitlist"}
                      </button>
                    )}
                  </div>
                ) : isReservedForOther ? (
                  <span className="text-sm text-card-light-muted">Reserved</span>
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
      <PodAssistBubble />
      <TourContinuation path="/book" />
      <BottomNav />
    </>
  );
}
