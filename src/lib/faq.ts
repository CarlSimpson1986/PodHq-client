export interface FaqItem {
  question: string;
  answer: string;
}

// Static, no LLM — deliberately cheap v1 (see podHq's memory notes on the
// "POD" assistant idea). Sourced from the three questions Hove staff say
// members actually ask most, not guessed. Add to this list as real
// questions come up; only build the fuller RAG/chat version if this stops
// being enough.
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How do I cancel my membership?",
    answer:
      "Go to Profile and tap “Cancel membership.” This cancels straight away — your access ends immediately rather than running until the end of your current billing period.",
  },
  {
    question: "I missed my booking — can I get my credit back?",
    answer:
      "Cancel the booking from the Bookings page more than 2 hours before your session and the credit is automatically returned. Cancelling within that 2-hour window, or not showing up, forfeits the credit.",
  },
  {
    question: "Can I bring my under-16 in?",
    answer:
      "Yes — there’s no minimum age. They just need to be accompanied by an adult and have a signed Under-16 Activity Waiver Form. Ask staff for a copy, or it can be sent ahead of your visit.",
  },
];
