import { RoomClientEventSchema } from "./room.schemas";
import type { OgsJoinEvent, RoomClientEvent } from "./room.types";

/** Verifies an OGS game token for this game: its claims, or null (expired, forged, another game's). */
export type TokenVerifier = (token: string) => Promise<{ sub: string; name: string } | null>;

type Join = Extract<RoomClientEvent, { type: "JOIN" }>;

function parse(message: string | ArrayBuffer): RoomClientEvent | null {
  const text = typeof message === "string" ? message : new TextDecoder().decode(message);
  try {
    const parsed = RoomClientEventSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * A socket message that is a JOIN carrying an OGS token, made trustworthy: a valid token becomes
 * OGS_JOIN (the seat takes the token's name, never the typed one); an invalid one becomes a plain
 * JOIN without the token. Null for every other message (actor-kit handles those).
 */
export async function trustJoin(
  message: string | ArrayBuffer,
  verify: TokenVerifier,
): Promise<OgsJoinEvent | Omit<Join, "ogsToken"> | null> {
  const event = parse(message);
  if (event?.type !== "JOIN" || event.ogsToken === undefined) return null;
  const claims = await verify(event.ogsToken).catch(() => null);
  if (!claims) return event.name === undefined ? { type: "JOIN" } : { type: "JOIN", name: event.name };
  return { type: "OGS_JOIN", profile: { id: claims.sub, name: claims.name } };
}
