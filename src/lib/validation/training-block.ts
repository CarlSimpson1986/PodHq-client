import { z } from "zod";
import { BLOCK_TYPES } from "@/lib/coach/types";

export const confirmTrainingBlockSchema = z.object({
  chosenBlockType: z.enum(BLOCK_TYPES),
});
