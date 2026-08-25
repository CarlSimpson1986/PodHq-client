// Small inline stroke-icon set — no icon library dependency, matches the
// minimal line-icon style GymFlow's app uses (Memberships/Credit
// Packs/Gift Voucher screens), sized for the hero banners and page headers.

type IconProps = { className?: string };

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 3v12M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  );
}

export function QuestionIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function UserPlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M4 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}

export function CoinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M13.5 6a6.5 6.5 0 1 1 0 12" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </svg>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function DumbbellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M2 10v4M22 10v4" />
      <path d="M5 8v8M19 8v8" />
      <rect x="4" y="9" width="2" height="6" rx="0.5" />
      <rect x="18" y="9" width="2" height="6" rx="0.5" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function ShopIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

export function GiftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3.5" y="9" width="17" height="4" rx="0.5" />
      <path d="M5 13h14v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8Z" />
      <path d="M12 9v13" />
      <path d="M12 9c-1.5-4-6.5-4-6.5-1S8.5 9 12 9ZM12 9c1.5-4 6.5-4 6.5-1S15.5 9 12 9Z" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M15 16l4-4-4-4" />
      <path d="M19 12H9" />
    </svg>
  );
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export function WifiOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" strokeLinecap="round" />
      <path d="M5 12.5a10 10 0 0 1 3.5-2.3M19 12.5a10 10 0 0 0-4.8-2.7" strokeLinecap="round" />
      <path d="M1.5 8.5a15 15 0 0 1 4-2.7M22.5 8.5a15 15 0 0 0-7-3.9" strokeLinecap="round" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IdCardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M6 16c0-1.4 1.1-2.5 2.5-2.5S11 14.6 11 16M14 9.5h5M14 13h5" />
    </svg>
  );
}

// 4-point sparkle — the "Coach" bottom-nav tab's icon. Distinct from
// DumbbellIcon (already used by "Book" and by the AI Coach visuals on
// Home/onboarding) so the new tab doesn't visually collide with them.
export function SparkleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" strokeLinejoin="round" />
    </svg>
  );
}

// The Coach nested nav's "Exit" item — deliberately not LogoutIcon (that
// means signing out of the account, a different action) and deliberately
// not HomeIcon (the main nav already uses that for the real Home tab;
// reusing it here would recreate the exact "two things called Home"
// confusion this nested nav was designed to avoid). A plain back arrow
// reads unambiguously as "leave this nav, go back."
export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The /coach/nutrition page header icon (Stage 6).
export function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M12 8.5c-3.5-2.3-8 0-8 5.2 0 4.3 3 8.3 5.7 8.3 1 0 1.6-.4 2.3-.4.7 0 1.3.4 2.3.4 2.4 0 5.7-3.6 5.7-8 0-3.2-2-5.5-4.7-5.5-1.3 0-2 .5-3.3.5Z" />
      <path d="M12 8.5c0-2 .8-4 3-4.5" strokeLinecap="round" />
    </svg>
  );
}

// The "More" overflow menu's trigger icon (2026-08-25 redesign) — Health/
// integration settings, Profile, and Home all moved behind this rather
// than staying primary tabs/header icons. Plain 3-line hamburger.
export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

// The member bottom nav's "Coach" tab icon (2026-08-25 redesign, replaced
// the Health tab) — distinct from SparkleIcon (already the Dashboard
// tab's icon in the same nav) so the two don't visually collide. A
// speech-bubble reads unambiguously as "talk to your coach".
export function ChatBubbleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// The multi-site leaderboard's icon (2026-08-25) — the More menu and
// its Dashboard card. A simple trophy, distinct from every other icon
// in the set.
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M7 4h10v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15v3M9 21h6M9.5 21c0-2 1-2.5 1-3M14.5 21c0-2-1-2.5-1-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The /coach/health page (Health Centre) header + nav icon.
export function HeartPulseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path
        d="M3 12h4l2-5 3 10 2-7 1.5 2H21"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 20s-7-4.5-9-8.6C1.5 8 3 5 6 5c2 0 3.3 1.3 4 2.3.7-1 2-2.3 4-2.3 3 0 4.5 3 3 6.4-2 4.1-5 5.9-5 8.6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
