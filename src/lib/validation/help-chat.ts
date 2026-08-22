import { z } from "zod";

// History capped at 6 turns and 1000 chars/message — bounds both the
// request payload and the LLM context size (and therefore cost) per call.
export const helpChatSchema = z
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
