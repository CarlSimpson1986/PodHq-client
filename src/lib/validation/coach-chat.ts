import { z } from "zod";

// Same bounds as help-chat's schema — caps both the request payload and
// the LLM context size (and therefore cost) per call.
export const coachChatSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(1000),
        })
      )
      .max(6)
      .default([]),
  })
  .strict();
