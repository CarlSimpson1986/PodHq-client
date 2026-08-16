// Extracted from /api/bookings' self-service hours check so the fix for a
// real bug (found 2026-08-11) has a regression test: Vercel's serverless
// functions run in UTC internally regardless of the `lhr1` region pin, so a
// plain `new Date(slotStartIso).getHours()` is off by exactly one hour
// during BST against the UK wall-clock hours staff configure in podHq's
// /pods. Reads the hour via Europe/London specifically instead.
export function isWithinBookableHours(slotStartIso: string, openHour: number, closeHour: number): boolean {
  const slotHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(
      new Date(slotStartIso)
    )
  );
  return slotHour >= openHour && slotHour < closeHour;
}
