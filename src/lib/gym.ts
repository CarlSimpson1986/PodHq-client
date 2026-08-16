// Full franchise gym list — must match podHq's GYM_NAMES exactly (used
// verbatim in Revenue/users_gyms/gym_outgoings and everywhere else across
// both apps' shared Supabase project). Signup now asks a new member which
// gym they belong to (2026-08-16), replacing the old single hardcoded
// PILOT_GYM constant this app used while it was "Aylesbury Berryfields
// only" — a gym other than Aylesbury having no pod/Kisi config yet doesn't
// block a member signing up correctly tagged to it, it just means that
// gym's booking/unlock features aren't live for them yet.
export const GYM_NAMES = [
  "Aylesbury Berryfields",
  "Basingstoke",
  "Berkhamsted",
  "Crewe",
  "Fairford Leys",
  "Hackney",
  "Kingston upon Thames",
  "Milton Keynes",
  "Oxford East",
] as const;

export type GymName = (typeof GYM_NAMES)[number];
