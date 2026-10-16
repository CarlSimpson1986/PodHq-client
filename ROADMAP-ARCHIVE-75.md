# PodHQ Client — Roadmap Archive 75

Reference-only, not auto-loaded. Split out of `ROADMAP.md` 2026-10-16 to
keep it within Claude Code's ~15,000-character `@`-import limit. Covers
PDK auto-link on first unlock and the booking-email timezone fix
(2026-09-23).

## PDK auto-link on first unlock, booking-email timezone fix — 2026-09-23

**Steve (Fairford Leys owner) got "Your access isn't set up yet — contact staff" at the door.** `api/unlock/route.ts` required `members.pdk_holder_id`, which only Carl's test account (member 157) ever had, set by hand in podHq's `0100` — every other PDK-gym member was locked out. Now, with no holder ID, the route sends the member's name/email to podHQ's `/api/pdk/unlock`, which reuses their PDK holder by exact email match or creates one, adds it to "Booking Access", unlocks, and returns the ID, saved here even on a failed unlock so a retry doesn't duplicate it. Proxy timeout raised 10s → 25s (a first unlock chains several PDK calls plus one 2s retry). Details in podHq's `ROADMAP_HISTORY.md` #66. **Verified live 2026-09-23 14:49** (member 158, Fairford Leys "Entrance"): PDK's own audit log shows the holder created and added to Booking Access by "Integration Client", then "Access allowed" via API — no manual PDK step, first read succeeded without the retry. Still not built: `members.unlimited_access` (owner unlock without booking, schema only).

**Follow-up, same session**: Carl's first live test hit "Turn on location services" — both Unlock buttons (`upcoming-session-card.tsx`, `bookings-view.tsx`) hard-stopped client-side whenever geolocation failed, even at Fairford Leys, whose resource has no coordinates so the server would never check. Location is now sent when available and omitted otherwise; the server remains the only gate (it still blocks a missing location at resources with coordinates).

**Speed follow-up**: Carl found the first live unlock slow. The Unlock buttons now only request geolocation when the resource has coordinates (`PodResource.requiresLocation`; unknown resources default to asking) and accept a fix up to 60s old — up to 10s of location lookup was dead time at Fairford Leys. podHQ caches its PDK token too (its `ROADMAP_HISTORY.md` #66).

**Location enforced at Fairford Leys + staff alert on door failure**: Carl set Fairford Leys' coordinates (51.820265, -0.836716, 100m radius — tighter than the 300m default, phone GPS indoors makes much below ~100m refuse genuine members). Only Aylesbury Berryfields had coordinates before (podHq `0013`); every other gym has no GPS gate, and PDK's API exposes no location (Kisi's does, per place/lock — an unbuilt option for backfilling Kisi gyms). New: when the door system itself fails (not this app's own "blocked:" refusals), the gym's owner(s) + admins get a `staff_unlock_failed` email (member name, mobile, door, slot, the door system's error) — once per booking, not per retry. Not yet seen fire live.

**Email logo not showing**: `https://www.myfitpod.app/icons/icon-512.png` returns 200, `podhq-client.vercel.app/...` 404s — consistent with Vercel's `APP_URL` still pointing at the retired alias (not inspected). `appUrl()` (`notifications/core.ts`) now returns the canonical `PRODUCTION_ORIGIN` in production regardless of `APP_URL`, fixing the logo and every email CTA link at once. Carl to confirm in the next real email.

**Booking emails showed slot times an hour early** — `formatSlot` in `notifications/templates.ts` had no `timeZone`, and Vercel runs UTC; now `Europe/London`.

**Not a bug**: a Brighton "AAL2 session is required to update email or password when MFA is enabled" reset error was the shared Hove podHQ staff login (2FA-enabled) being entered in the member app. Staff logins reset via podHQ; members should use their own email.
