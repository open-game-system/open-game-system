import { DirectionSchema, SessionStateSchema } from "@open-game-system/ogs-protocol";
import { z } from "zod";

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), state: SessionStateSchema }),
  z.object({ type: z.literal("focus.move"), dir: DirectionSchema }),
  z.object({ type: z.literal("error"), error: z.unknown().optional() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export function parseServerMessage(raw: string): ServerMessage | null {
  let json: unknown;
  // Stryker disable BlockStatement: equivalent, parsing undefined fails the schema and returns null
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  // Stryker restore BlockStatement
  const r = ServerMessageSchema.safeParse(json);
  return r.success ? r.data : null;
}
