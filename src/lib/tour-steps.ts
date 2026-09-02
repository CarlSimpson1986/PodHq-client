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
export const TOUR_STEPS: TourStep[] = [
  {
    path: "/",
    element: "#tour-greeting",
    popover: {
      title: "Welcome to My Fit Pod",
      description:
        "Quick tour — I'll show you how to book a session and buy credits or a membership. You can always tap the Pod Assist icon (top right) again later if you get stuck.",
    },
  },
  {
    path: "/",
    element: "#tour-credits",
    popover: {
      title: "Your credits",
      description: "Each session uses one credit — I'll show you exactly where to top up in a moment.",
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
    element: "#tour-nav-book",
    popover: {
      title: "Let's book a session",
      description: "Tap here any time — for now, let's go take a look.",
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
      description: "Tap Book next to any free slot — it reserves your pod and unlocks the door automatically when your session starts.",
    },
  },
  {
    path: "/book",
    element: "#tour-book-credits",
    popover: {
      title: "How to buy a credit",
      description: "Out of credits? Tap Buy more here any time to top up — this is exactly how you'd buy one.",
    },
  },
  {
    path: "/book",
    element: "#tour-nav-shop",
    popover: {
      title: "Now, a membership",
      description: "Let's take a look at how to get a monthly membership instead.",
    },
  },
  {
    path: "/shop",
    element: "#tour-shop-membership",
    popover: {
      title: "How to buy a membership",
      description: "Tap here to browse and subscribe — a monthly membership gives you a recurring credit allowance instead of buying one-off packs.",
    },
  },
  {
    path: "/shop",
    element: "#tour-help-button",
    popover: {
      title: "That's it!",
      description: "Tap this icon any time, on any page, if you get stuck or want to ask a question.",
    },
  },
];
