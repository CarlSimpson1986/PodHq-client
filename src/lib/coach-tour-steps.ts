export interface CoachTourStep {
  element: string;
  popover: { title: string; description: string };
}

// Pod Coach's own guided tour of the Dashboard — the Premium-side mirror
// of Pod Assist's tour of Home/Shop/Book (tour-steps.ts). Single page, so
// no cross-page hand-off machinery is needed (contrast tour-continuation.tsx)
// — coach-tour-runner.tsx just drives this list start to finish. Order
// matches the Dashboard's actual top-to-bottom layout (dashboard/page.tsx).
export const COACH_TOUR_STEPS: CoachTourStep[] = [
  {
    element: "#tour-coach-week",
    popover: {
      title: "Your training week",
      description: "Every day this week, at a glance — tap a day to see what's planned.",
    },
  },
  {
    element: "#tour-coach-recovery",
    popover: {
      title: "Recovery",
      description: "Connect a wearable and I'll factor your sleep and resting heart rate into what I recommend.",
    },
  },
  {
    element: "#tour-coach-sessions",
    popover: {
      title: "This week's sessions",
      description: "How you're tracking against your target session count for the week.",
    },
  },
  {
    element: "#tour-coach-nutrition",
    popover: {
      title: "Nutrition",
      description: "Your average daily calories and macros, logged from the Nutrition tab.",
    },
  },
  {
    element: "#tour-coach-recommendation",
    popover: {
      title: "My recommendation",
      description: "What I think you should focus on this week, based on everything above.",
    },
  },
  {
    element: "#tour-coach-habit",
    popover: {
      title: "Your habit streak",
      description: "The one habit we're building together, and how consistently you're keeping it up.",
    },
  },
  {
    element: "#tour-coach-leaderboard",
    popover: {
      title: "Leaderboard",
      description: "See how you stack up against everyone else — sessions, streaks and steps, every gym.",
    },
  },
  {
    element: "#tour-coach-label",
    popover: {
      title: "That's it!",
      description: "Tap this icon any time you want to check in, ask a question, or see what I'd recommend today.",
    },
  },
];
