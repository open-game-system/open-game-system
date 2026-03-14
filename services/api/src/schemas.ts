import { z } from "zod";

// Request schemas — parse at the boundary

export const RegisterDeviceSchema = z.object({
  ogsDeviceId: z.string().check(z.minLength(1)),
  platform: z.enum(["ios", "android"]),
  pushToken: z.string().check(z.minLength(1)),
});

export const SendNotificationSchema = z.object({
  deviceToken: z.string().check(z.minLength(1)),
  notification: z.object({
    title: z.string().check(z.minLength(1)),
    body: z.string().check(z.minLength(1)),
    data: z.record(z.string(), z.string()).optional(),
  }),
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
  deviceToken: z.string(),
  registered: z.literal(true),
});

export const SendNotificationResponseSchema = z.object({
  id: z.string().check(z.uuid()),
  status: z.literal("sent"),
  deviceActive: z.literal(true),
});

export const PushFailedResponseSchema = z.object({
  error: z.object({
    code: z.literal("push_failed"),
    message: z.string(),
    status: z.literal(502),
  }),
  deviceActive: z.boolean(),
});

// JWT payload schema

export const DeviceTokenPayloadSchema = z.object({
  sub: z.string(),
  iat: z.number(),
  iss: z.literal("ogs-api"),
});

// Cast session schemas

export const CreateCastSessionSchema = z.object({
  deviceId: z.string().check(z.minLength(1)),
  viewUrl: z.string().check(z.url()).check(z.startsWith("https://")),
});

export const CastStateUpdateSchema = z.object({
  state: z.record(z.string(), z.unknown()),
});

export const CreateCastSessionResponseSchema = z.object({
  sessionId: z.string().check(z.uuid()),
  streamSessionId: z.string(),
  streamUrl: z.string(),
  status: z.literal("active"),
});

export const CastSessionStatusResponseSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["pending", "active", "idle", "ended"]),
  streamSessionId: z.string().nullable(),
  streamUrl: z.string().nullable(),
});

export const CastSessionEndedResponseSchema = z.object({
  status: z.literal("ended"),
});

// Type exports

export type RegisterDeviceInput = z.infer<typeof RegisterDeviceSchema>;
export type SendNotificationInput = z.infer<typeof SendNotificationSchema>;
export type DeviceTokenPayload = z.infer<typeof DeviceTokenPayloadSchema>;
export type CreateCastSessionInput = z.infer<typeof CreateCastSessionSchema>;
export type CastStateUpdateInput = z.infer<typeof CastStateUpdateSchema>;
