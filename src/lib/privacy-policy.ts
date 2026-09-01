import type { WaiverBlock } from "@/lib/waiver-terms";

// DRAFT — written 2026-09-01 to fill a real gap: the Ts&Cs document
// (waiver-terms.ts / terms-and-conditions.ts) references a Privacy
// Policy "in Clause 26" five separate times, but Clause 26 doesn't
// actually exist in that document — confirmed by reading the real PDF,
// not assumed. Nothing formal was found anywhere else either. This is
// grounded in what the app actually does (data flows verified against
// the real code — Stripe, Kisi, the wearables tables, coach-chat.ts's
// LLM provider, etc.), not generic boilerplate. It has NOT had legal
// review — treat it as a first draft for Carl/a solicitor to check
// before it's relied on as the business's actual, final policy.
//
// Updated same day (later) once Pod Coach/Pod Assist and /progress
// existed as real, separate, named things — Section 1's chat bullet and
// Section 4's provider entry previously said "AI Coach" generically and
// didn't distinguish the two: Pod Coach (premium, personalised, sees
// training/recovery/nutrition/body data) and Pod Assist (every member,
// scoped to bookings/credits/gym policy only per help-bot.ts's own
// system prompt — genuinely never touches health data at all, worth
// stating plainly rather than leaving it implied). Both currently run on
// whichever of Groq/Anthropic is configured (coach-chat.ts and
// help-bot.ts use the identical fallback order) — not fixed to one
// provider each, so this doesn't claim otherwise. Added a Training/
// workout data bullet to Section 1 too — reps, weight lifted and RPE
// were being collected already (hypertrophy/custom-format training) but
// were never actually listed as their own category, not something new
// this session added.
export const PRIVACY_POLICY: WaiverBlock[] = [
  { type: "heading", text: "Privacy Policy" },
  {
    type: "paragraph",
    text: "This Privacy Policy explains what personal data My Fit Pod Ltd (\"My Fit Pod\", \"we\", \"us\") collects through the My Fit Pod Website, Mobile Application and Network, why, and what rights you have over it. It's referred to throughout our Terms & Conditions as \"the Privacy Policy\" and forms part of that agreement.",
  },
  {
    type: "paragraph",
    text: "My Fit Pod Ltd is a company registered in England and Wales (company number 13168737, VAT number 336466191). Questions or requests about this policy: hello@myfitpod.co.uk.",
  },

  { type: "subheading", text: "1. WHAT WE COLLECT" },
  {
    type: "list",
    items: [
      {
        title: "Account details",
        body: "name, email address, mobile number, gender, home address, and the password/authentication details for your Account.",
      },
      {
        title: "Payment information",
        body: "held and processed by our payment processor, Stripe, not stored on our own servers — see Section 4.",
      },
      {
        title: "Booking and usage data",
        body: "which gym, which sessions, credits/membership status, and door-access events (when you unlock a facility via Kisi).",
      },
      {
        title: "Health and fitness data (optional)",
        body: "if you choose to connect a wearable (Fitbit or, on Android, Health Connect) or log data yourself: steps, sleep, resting heart rate, heart-rate variability, and body measurements (weight, waist, hip) you enter. See Section 5.",
      },
      {
        title: "Training and workout data",
        body: "your workout sessions, and per-set detail (reps, weight, RPE) for exercises you complete, used to track your progress and personalise future sessions.",
      },
      {
        title: "Nutrition entries",
        body: "meals you log and your calculated daily targets, used to show your own nutrition history and by Pod Coach to personalise guidance.",
      },
      {
        title: "Pod Coach chat content (premium members)",
        body: "questions you ask Pod Coach, and the training/recovery/nutrition/body-measurement context needed to answer them, are sent to a third-party AI provider to generate a response. See Section 8.",
      },
      {
        title: "Pod Assist chat content (all members)",
        body: "questions you ask Pod Assist — scoped to bookings, credits and gym policy only, never your health data — are sent to a third-party AI provider to generate a response.",
      },
      {
        title: "Device and technical data",
        body: "IP address, device type, and (if you enable them) push-notification subscription details, used for security, rate-limiting and sending you notifications you've asked for.",
      },
    ],
  },

  { type: "subheading", text: "2. WHY WE COLLECT IT" },
  {
    type: "paragraph",
    text: "We use your data to: provide and administer your Account and bookings; process payments; operate physical door access (Kisi); personalise Pod Coach's training, nutrition and recovery guidance; answer questions via Pod Assist; send service messages (booking confirmations, reminders); and maintain the security of the Website, Mobile Application and Network. We do not sell your personal data.",
  },

  { type: "subheading", text: "3. LAWFUL BASIS" },
  {
    type: "paragraph",
    text: "We process your data under UK GDPR on the following bases: performance of our contract with you (Account, bookings, payments, access); legitimate interests (security, fraud prevention, service improvement); and your consent, which you can withdraw at any time, for optional features — connecting a wearable, and using Pod Coach (see Section 8).",
  },

  { type: "subheading", text: "4. WHO WE SHARE IT WITH" },
  {
    type: "list",
    items: [
      { title: "Stripe", body: "processes your payments and card details under its own Privacy Policy and Terms — we don't store full card details ourselves." },
      { title: "Kisi", body: "our door-access provider, receives what's needed to grant/log physical entry to a My Fit Pod facility." },
      {
        title: "Our AI providers (Pod Coach and Pod Assist)",
        body: "depending on configuration, your messages are processed by Groq or Anthropic (Claude) to generate a response — Pod Assist only ever sees booking/policy questions, never health data. Neither provider builds a profile of you for their own purposes.",
      },
      { title: "Resend", body: "sends transactional emails on our behalf (booking confirmations, reminders)." },
      {
        title: "Fitbit / Google Health, or Health Connect",
        body: "if you connect a wearable, we read the specific data types you authorise from that provider or your device's on-device Health Connect store — nothing else.",
      },
    ],
  },
  {
    type: "paragraph",
    text: "Some of these providers are based outside the UK/EEA (e.g. the US). Where that's the case, they operate under their own approved data-transfer safeguards (such as the UK's International Data Transfer Addendum or equivalent). We do not otherwise sell, rent or share your personal data with third parties for their own marketing purposes.",
  },

  { type: "subheading", text: "5. HEALTH DATA SPECIFICALLY" },
  {
    type: "paragraph",
    text: "Connecting a wearable (Fitbit or Health Connect) is entirely optional and off by default. If you connect one, we read steps, sleep, resting heart rate and heart-rate variability to personalise your Pod Coach recovery status and weekly check-in — nothing else, and nothing is shared beyond what Section 4 describes. Disconnecting a wearable at any time (Health page for non-premium members, Progress page for premium members → Disconnect) permanently deletes every data point we've stored from it, immediately — not just future syncing. Body measurements and nutrition/workout logs you enter yourself follow the same principle: visible to you and to Pod Coach for personalisation, deletable via a request to hello@myfitpod.co.uk.",
  },

  { type: "subheading", text: "6. HOW LONG WE KEEP IT" },
  {
    type: "paragraph",
    text: "We keep Account and booking data for as long as your Account is active, and for a reasonable period after closure to meet our legal, accounting and insurance obligations. Wearable/health data is deleted immediately on disconnection (Section 5). You can ask us to delete your Account and associated data at any time by emailing hello@myfitpod.co.uk, subject to what we're required to retain by law.",
  },

  { type: "subheading", text: "7. YOUR RIGHTS" },
  {
    type: "paragraph",
    text: "Under UK GDPR you have the right to: access the personal data we hold about you; have inaccurate data corrected; request erasure; restrict or object to certain processing; and data portability. To exercise any of these, email hello@myfitpod.co.uk. If you're unhappy with how we've handled your data, you also have the right to complain to the Information Commissioner's Office (ico.org.uk).",
  },

  { type: "subheading", text: "8. POD COACH AND AI-GENERATED ADVICE" },
  {
    type: "paragraph",
    text: "Pod Coach uses a third-party AI model to generate personalised training, nutrition and recovery guidance based on data described in Sections 1 and 5. It is not a substitute for medical advice, and My Fit Pod accepts no responsibility for actions taken based on its output — the same principle as Clause 18 (Waiver) and Clause 19 (Limitation of Liability) of our Terms & Conditions.",
  },
  {
    type: "paragraph",
    text: "Because Pod Coach can process health-related data and generate advice you may act on, we ask for your explicit, separate consent before your first use of it, recorded with a timestamp against your Account. You can withdraw this consent at any time by disconnecting any connected wearable and contacting hello@myfitpod.co.uk to stop using Pod Coach — this does not affect your ability to use the rest of My Fit Pod.",
  },

  { type: "subheading", text: "9. CHANGES TO THIS POLICY" },
  {
    type: "paragraph",
    text: "We may update this Privacy Policy from time to time. Material changes will be highlighted the next time you sign in, and continued use of My Fit Pod after that means you accept the update — the same principle set out in Clause 1 of our Terms & Conditions.",
  },

  { type: "subheading", text: "10. CONTACT US" },
  { type: "paragraph", text: "Questions, requests, or complaints about this policy: hello@myfitpod.co.uk." },
];
