/**
 * Cast Kit protocol definition
 * 
 * This module defines the message format and types for communication
 * between web games and the native OpenGame App.
 */

import { z } from 'zod';

/**
 * Base message schema
 */
export const baseMessageSchema = z.object({
  type: z.string(),
  payload: z.record(z.any()),
  requestId: z.string().optional(),
});

export type BaseMessage = z.infer<typeof baseMessageSchema>;

/**
 * CAST_READY message - Sent from web to native when the game is ready to cast
 */
export const castReadySchema = baseMessageSchema.extend({
  type: z.literal('CAST_READY'),
  payload: z.object({
    gameId: z.string(),
    roomCode: z.string().optional(),
    broadcastUrl: z.string().optional(),
    capabilities: z.array(z.string()).optional(),
  }),
});

export type CastReadyMessage = z.infer<typeof castReadySchema>;

/**
 * CAST_INITIALIZED message - Sent from native to web when Cast SDK is initialized
 */
export const castInitializedSchema = baseMessageSchema.extend({
  type: z.literal('CAST_INITIALIZED'),
  payload: z.object({
    available: z.boolean(),
    devices: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        isConnected: z.boolean(),
      })
    ).optional(),
  }),
});

export type CastInitializedMessage = z.infer<typeof castInitializedSchema>;

/**
 * CAST_SCAN_DEVICES message - Sent from web to native to request device scan
 */
export const castScanDevicesSchema = baseMessageSchema.extend({
  type: z.literal('CAST_SCAN_DEVICES'),
  payload: z.object({}),
});

export type CastScanDevicesMessage = z.infer<typeof castScanDevicesSchema>;

/**
 * CAST_DEVICES_UPDATED message - Sent from native to web when devices list is updated
 */
export const castDevicesUpdatedSchema = baseMessageSchema.extend({
  type: z.literal('CAST_DEVICES_UPDATED'),
  payload: z.object({
    devices: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        isConnected: z.boolean(),
      })
    ),
  }),
});

export type CastDevicesUpdatedMessage = z.infer<typeof castDevicesUpdatedSchema>;

/**
 * CAST_START_SESSION message - Sent from web to native to start casting
 */
export const castStartSessionSchema = baseMessageSchema.extend({
  type: z.literal('CAST_START_SESSION'),
  payload: z.object({
    deviceId: z.string(),
    initialState: z.record(z.any()).optional(),
  }),
});

export type CastStartSessionMessage = z.infer<typeof castStartSessionSchema>;

/**
 * CAST_SESSION_UPDATED message - Sent from native to web to update session status
 */
export const castSessionUpdatedSchema = baseMessageSchema.extend({
  type: z.literal('CAST_SESSION_UPDATED'),
  payload: z.object({
    status: z.enum(['connecting', 'connected', 'terminated', 'error']),
    deviceId: z.string(),
    deviceName: z.string(),
    sessionId: z.string(),
    error: z.any().nullable(),
  }),
});

export type CastSessionUpdatedMessage = z.infer<typeof castSessionUpdatedSchema>;

/**
 * CAST_END_SESSION message - Sent from web to native to end casting session
 */
export const castEndSessionSchema = baseMessageSchema.extend({
  type: z.literal('CAST_END_SESSION'),
  payload: z.object({}),
});

export type CastEndSessionMessage = z.infer<typeof castEndSessionSchema>;

/**
 * CAST_STATE_UPDATE message - Sent from web to native to update cast state
 */
export const castStateUpdateSchema = baseMessageSchema.extend({
  type: z.literal('CAST_STATE_UPDATE'),
  payload: z.object({
    state: z.record(z.any()),
    timestamp: z.number().optional(),
  }),
});

export type CastStateUpdateMessage = z.infer<typeof castStateUpdateSchema>;

/**
 * CAST_STATE_CONFIRMED message - Sent from native to web to confirm state update
 */
export const castStateConfirmedSchema = baseMessageSchema.extend({
  type: z.literal('CAST_STATE_CONFIRMED'),
  payload: z.object({
    status: z.string(),
    timestamp: z.number().optional(),
  }),
});

export type CastStateConfirmedMessage = z.infer<typeof castStateConfirmedSchema>;

/**
 * CAST_ERROR message - Sent from native to web for error notification
 */
export const castErrorSchema = baseMessageSchema.extend({
  type: z.literal('CAST_ERROR'),
  payload: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
});

export type CastErrorMessage = z.infer<typeof castErrorSchema>;

/**
 * Union of all message schemas
 */
export const messageSchema = z.union([
  castReadySchema,
  castInitializedSchema,
  castScanDevicesSchema,
  castDevicesUpdatedSchema,
  castStartSessionSchema,
  castSessionUpdatedSchema,
  castEndSessionSchema,
  castStateUpdateSchema,
  castStateConfirmedSchema,
  castErrorSchema,
]);

export type CastMessage = z.infer<typeof messageSchema>;

/**
 * Validate a message against the schema
 */
export function validateMessage(message: unknown): boolean {
  try {
    messageSchema.parse(message);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Helper function to create a message with request ID
 */
export function createMessage<T extends BaseMessage>(message: T): T {
  if (!message.requestId) {
    return {
      ...message,
      requestId: generateRequestId(),
    };
  }
  return message;
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15);
} 