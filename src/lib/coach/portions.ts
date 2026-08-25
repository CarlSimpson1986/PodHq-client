import { PALM_PROTEIN_G, CUPPED_HAND_CARBS_G, THUMB_FAT_G } from "@/lib/coach/types";

export interface PortionCounts {
  palms: number;
  cuppedHands: number;
  thumbs: number;
}

function toNearestHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

// Grams → whole/half palm-of-protein / cupped-hand-of-carbs / thumb-of-fat
// counts, using the approximations in types.ts (PALM_PROTEIN_G etc — the
// brief's own numbers, Carl can retune). Rounds to the nearest half unit
// rather than a whole number, since "1 palm" vs "1.5 palms" is the same
// granularity the brief's own mockup shows (half-filled emoji).
export function gramsToPortions(proteinG: number, carbsG: number, fatG: number): PortionCounts {
  return {
    palms: toNearestHalf(proteinG / PALM_PROTEIN_G),
    cuppedHands: toNearestHalf(carbsG / CUPPED_HAND_CARBS_G),
    thumbs: toNearestHalf(fatG / THUMB_FAT_G),
  };
}
