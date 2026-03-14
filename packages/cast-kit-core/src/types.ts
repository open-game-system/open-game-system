import { z } from 'zod';

export const CastDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['chromecast', 'airplay']),
});

export type CastDevice = z.infer<typeof CastDeviceSchema>;

export const CastSessionSchema = z.object({
  status: z.enum(['disconnected', 'connecting', 'connected']),
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
  sessionId: z.string().nullable(),
  streamSessionId: z.string().nullable(),
});

export type CastSession = z.infer<typeof CastSessionSchema>;

export const CastStateSchema = z.object({
  isAvailable: z.boolean(),
  devices: z.array(CastDeviceSchema),
  session: CastSessionSchema,
  error: z.string().nullable(),
});

export type CastState = z.infer<typeof CastStateSchema>;

export const CastEventsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SCAN_DEVICES') }),
  z.object({ type: z.literal('START_CASTING'), deviceId: z.string() }),
  z.object({ type: z.literal('STOP_CASTING') }),
  z.object({ type: z.literal('SEND_STATE_UPDATE'), payload: z.unknown() }),
  z.object({ type: z.literal('SHOW_CAST_PICKER') }),
  z.object({ type: z.literal('RESET_ERROR') }),
]);

export type CastEvents = z.infer<typeof CastEventsSchema>;

export type CastStores = {
  cast: {
    state: CastState;
    events: CastEvents;
  };
};
