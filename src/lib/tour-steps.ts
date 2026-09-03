export interface TourStep {
  path: string;
  element: string;
  popover: { title: string; description: string };
}

// The full first-login guided tour, spanning three real pages — not just
// Home. Extended 2026-09-02 (Carl: "THE TOUR SHOULD HIGHLIGHT EACH PAGE
// AND EACH FEATURE! LIKE HOW TO BUY A CREDIT OR MEMBERSHIP, THE HOW TO
// BOOK") after v1 was deliberately scoped to Home-only. `TourRunner`
// drives a contiguous run of steps sharing one `path`, then either
// navigates to the next step's page (steps naturally finished) or stops
// (closed early) — see tour-runner.tsx. Order matters: this array *is*
// the tour's sequence.
//
// Reordered same day, second pass (Carl: "book session before buy a
// credit" is backwards, and "saying the going to the shop is to only buy
// membership" undersold what's there) — Shop now comes before Book
// (you need credits before you can book, so teach that first) and Shop's
// own two steps cover both Credit Packs and Memberships, not just one.
export const TOUR_STEPS: TourStep[] = [
  {
    path: "/",
    element: "#tour-greeting",
    popover: {
      title: "Welcome to My Fit Pod",
      description:
        "Quick tour — I'll show you how to buy credits or a membership, then how to book a session. You can always tap the Pod Assist icon (top right) again later if you get stuck.",
    },
  },
  {
    path: "/",
    element: "#tour-session-card",
    popover: {
      title: "Your next session",
      description: "Once you've booked, it shows here — with the door unlock ready when it's time.",
    },
  },
  {
    path: "/",
    element: "#tour-leaderboard",
    popover: {
      title: "Leaderboard",
      description: "See how you stack up against everyone else — sessions, streaks and steps, across every gym.",
    },
  },
  {
    path: "/",
    element: "#tour-find-professional",
    popover: {
      title: "Find a professional",
      description: "Browse personal trainers at your gym and get in touch directly.",
    },
  },
  {
    path: "/",
    element: "#tour-credits",
    popover: {
      title: "Your credits",
      description: "Each session uses one credit — let's show you where to buy some first.",
    },
  },
  {
    path: "/",
    element: "#tour-nav-shop",
    popover: {
      title: "First, let's get you credits",
      description: "You'll need at least one credit before you can book — let's go see how.",
    },
  },
  {
    path: "/shop",
    element: "#tour-shop-credits",
    popover: {
      title: "How to buy a credit",
      description: "Tap here to browse and buy a credit pack — this is exactly how you'd top up.",
    },
  },
  {
    path: "/shop",
    element: "#tour-shop-membership",
    popover: {
      title: "How to buy a membership",
      description: "Or tap here for a monthly membership instead — a recurring credit allowance at a reduced rate compared to buying one-off packs.",
    },
  },
  {
    path: "/shop",
    element: "#tour-shop-gift-voucher",
    popover: {
      title: "Gift vouchers",
      description: "You can also buy a gift voucher here — a nice way to introduce someone else to the club.",
    },
  },
  {
    path: "/shop",
    element: "#tour-nav-book",
    popover: {
      title: "Now, let's book a session",
      description: "Credits sorted — let's go book your first session.",
    },
  },
  {
    path: "/book",
    element: "#tour-book-dates",
    popover: {
      title: "Pick a day",
      description: "Swipe through the days to find one that works for you.",
    },
  },
  {
    path: "/book",
    element: "#tour-book-slots",
    popover: {
      title: "Book a time",
      description: "Tap Book next to any free slot — it reserves your pod. The door only unlocks from 5 minutes before your session, and only once you're physically at the gym.",
    },
  },
  {
    path: "/book",
    element: "#tour-help-label",
    popover: {
      title: "That's it!",
      description: "Tap this icon any time, on any page, if you get stuck or want to ask a question.",
    },
  },
];
