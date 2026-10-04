import {
  ClientKindSchema,
  DirectionSchema,
  RosterEntrySchema,
  type SessionState,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";

/**
 * The protocol exports SessionState as an interface only; this schema parses it at the socket.
 * `satisfies` below keeps it in lockstep with the interface.
 */
const SuspendedSchema = z.object({
  appId: z.string(),
  instanceId: z.string(),
  label: z.string(),
  at: z.number(),
});
const CurrentSchema = z.object({
  appId: z.string(),
  instanceId: z.string(),
  mode: z.enum(["continue", "new"]),
  roster: z.array(RosterEntrySchema),
  label: z.string(),
  startedAt: z.number(),
  viewUrl: z.string().nullable(),
  hostDeviceId: z.string().nullable(),
});
const DeviceSchema = z.object({
  deviceId: z.string(),
  kind: ClientKindSchema,
  personId: z.string().optional(),
  online: z.boolean(),
});
export const SessionStateSchema = z.object({
  householdId: z.string(),
  cast: z.boolean(),
  screen: z.enum(["home", "game-page", "game"]),
  focus: z.string().nullable(),
  page: z.string().nullable(),
  current: CurrentSchema.nullable(),
  suspended: z.array(SuspendedSchema),
  remote: z.string().nullable(),
  devices: z.array(DeviceSchema),
  rosters: z.record(z.array(RosterEntrySchema)),
  casts: z.number(),
}) satisfies z.ZodType<SessionState>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), state: SessionStateSchema }),
  z.object({ type: z.literal("focus.move"), dir: DirectionSchema }),
  z.object({ type: z.literal("error"), error: z.unknown().optional() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseServerMessage(raw: string): ServerMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const r = ServerMessageSchema.safeParse(json);
  return r.success ? r.data : null;
}
