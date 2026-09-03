export interface CoachTourStep {
  path: string;
  element: string;
  popover: { title: string; description: string };
}

// Pod Coach's own guided tour — the Premium-side mirror of Pod Assist's
// tour of Home/Shop/Book (tour-steps.ts), extended 2026-09-03 to actually
// walk /training and /nutrition rather than stopping at Dashboard's own
// summary cards (Carl: "you havent gone through the training system or
// the nutrition"). Cross-page hand-off follows the exact same
// coach-tour-runner.tsx/coach-tour-continuation.tsx/coach-tour-state.ts
// pattern as tour-runner.tsx/tour-continuation.tsx/tour-state.ts.
//
// "Your habit streak" (Dashboard's Main Effort card) removed the same
// day — Carl: not needed here, the same habit tracking is already shown
// on the main Home screen.
export const COACH_TOUR_STEPS: CoachTourStep[] = [
  {
    path: "/dashboard",
    element: "#tour-coach-week",
    popover: {
      title: "Your training week",
      description: "Every day this week, at a glance — tap a day to see what's planned.",
    },
  },
  {
    path: "/dashboard",
    element: "#tour-coach-recovery",
    popover: {
      title: "Recovery",
      description: "Connect a wearable and I'll factor your sleep and resting heart rate into what I recommend.",
    },
  },
  {
    path: "/dashboard",
    element: "#tour-coach-sessions",
    popover: {
      title: "This week's sessions",
      description: "How you're tracking against your target session count for the week.",
    },
  },
  {
    path: "/dashboard",
    element: "#tour-coach-nutrition",
    popover: {
      title: "Nutrition",
      description: "Your average daily calories and macros — let's go look at the real thing next.",
    },
  },
  {
    path: "/dashboard",
    element: "#tour-coach-recommendation",
    popover: {
      title: "My recommendation",
      description: "What I think you should focus on this week, based on everything above.",
    },
  },
  {
    path: "/dashboard",
    element: "#tour-coach-leaderboard",
    popover: {
      title: "Leaderboard",
      description: "See how you stack up against everyone else — sessions, streaks and steps, every gym.",
    },
  },
  {
    path: "/training",
    element: "#tour-coach-training-next",
    popover: {
      title: "Your next session",
      description: "Once you've booked, your personalised workout for it is ready here.",
    },
  },
  {
    path: "/training",
    element: "#tour-coach-training-block",
    popover: {
      title: "Your training block",
      description: "The multi-week plan I've built you — what's coming up and how it progresses.",
    },
  },
  {
    path: "/training",
    element: "#tour-coach-training-consistency",
    popover: {
      title: "Consistency",
      description: "How many sessions you've actually completed each week, against your target.",
    },
  },
  {
    path: "/nutrition",
    element: "#tour-coach-nutrition-summary",
    popover: {
      title: "Your daily targets",
      description: "Calories and macros worked out from your body stats — how today's tracking against them.",
    },
  },
  {
    path: "/nutrition",
    element: "#tour-coach-nutrition-log",
    popover: {
      title: "Log a meal",
      description: "Tap any meal to add food to it — search, scan a barcode, or log a custom item.",
    },
  },
  {
    path: "/nutrition",
    element: "#tour-coach-label",
    popover: {
      title: "That's it!",
      description: "Tap this icon any time you want to check in, ask a question, or see what I'd recommend today.",
    },
  },
];
