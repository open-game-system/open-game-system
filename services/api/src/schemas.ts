import { z } from "zod";

// Request schemas — parse at the boundary

export const RegisterDeviceSchema = z.object({
  ogsDeviceId: z.string().check(z.minLength(1)),
  platform: z.enum(["ios", "android"]),
  pushToken: z.string().check(z.minLength(1)),
});

// Response schemas — for test assertions

export const OgsErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.number(),
  }),
});

export const RegisterDeviceResponseSchema = z.object({
  deviceId: z.string(),
  registered: z.literal(true),
});

// Type exports

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
