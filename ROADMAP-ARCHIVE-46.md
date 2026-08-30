# Archive 46 — Injury-keyword coverage expanded (2026-08-30)

Split out 2026-08-30 to keep `ROADMAP.md` within the ~15,000-character
import limit — oldest section in that file at the time, live-verified.
Reference-only, not `@`-included anywhere.

## Injury-keyword coverage expanded to full body parts — 2026-08-30

Asked to expand the pain-caution/standing-injuries keyword list beyond
its original six (knee, back, shoulders, hip, ankle, wrist). Added
**neck, elbow, hamstring, calf, groin, quad** across 86 of the catalog's
98 exercises, tagged by real movement pattern rather than blanket-applied:
elbow on nearly every press/pull/curl (the most common gym overuse
site), hamstring/quad/calf weighted per exercise (a squat gets all
three; a hip-hinge RDL gets hamstring only — a hinge barely touches the
quads), groin only where a movement genuinely stretches the adductors
(sumo deadlift, reverse/deficit lunges), neck on overhead
presses/shrugs/face-pulls/the kettlebell halo. Surfaced two real gaps in
the existing tagging while at it: `dumbbell_calf_raise` had no injury
tags at all despite being *the* calf exercise, and `lying_leg_curl` (a
hamstring isolation machine) had no hamstring tag.

Caught a repeat of the shoulder singular/plural bug (see the coaching-
review stage in an earlier archive) before it shipped: "calf" pluralises
irregularly to "calves", not "calfs" — the same silent-match-failure
class, just for "my calves hurt" instead of "my shoulder hurts". Fixed
generally with an irregular-plurals map (`IRREGULAR_INJURY_PLURALS`)
alongside the existing trailing-"s" strip, so the next irregular plural
(English has a few more — foot/feet, if that's ever added) is a
one-line addition, not a new bug to rediscover.

**Verified**: `tsc --noEmit`, `eslint`, `npx vitest run` (158/158, +1
regression test for calf/calves), and `npm run build` all clean. Purely
additive to `avoidIfInjury` arrays — no existing exercise's tags were
changed or removed, confirmed by every pre-existing test still passing
unmodified.
