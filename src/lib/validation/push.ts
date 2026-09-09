import { z } from "zod";

export const pushSubscribeSchema = z
  .object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  })
  .strict();

export const pushRegisterDeviceSchema = z
  .object({
    fcmToken: z.string().min(1),
    platform: z.enum(["android", "ios"]),
  })
  .strict();
