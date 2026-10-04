import { type GameToken, GameTokenSchema } from "@open-game-system/ogs-protocol";

export type { GameToken };

export function base64UrlToBytes(part: string): Uint8Array<ArrayBuffer> {
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** The JSON in one base64url part of a JWT, or undefined when it isn't any. */
export function jsonPart(part: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
  } catch {
    return undefined;
  }
}

/**
 * The claims of a game token, decoded but NOT verified: for showing who's playing in the page.
 * Anything that matters (scores, seats) must use verifyOgsToken on the game's server.
 */
export function readGameToken(token: string): GameToken | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const parsed = GameTokenSchema.safeParse(jsonPart(parts[1]));
  return parsed.success ? parsed.data : null;
}
