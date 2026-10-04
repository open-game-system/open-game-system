import { type Claims, ClaimsSchema } from "@open-game-system/ogs-protocol";
import { signJwt, verifyJwt } from "./jwt";

export type ClaimsInput = Omit<Claims, "exp">;

export const DEVICE_TOKEN_TTL_S = 365 * 24 * 60 * 60;
export const LAUNCHER_TOKEN_TTL_S = 12 * 60 * 60;

/** Signs profile claims (ogs-protocol ClaimsSchema) with an expiry `ttlSeconds` after `now`. */
export async function issueToken(
  claims: ClaimsInput,
  secret: string,
  opts: { now: number; ttlSeconds: number },
): Promise<string> {
  const exp = Math.floor(opts.now / 1000) + opts.ttlSeconds;
  const { sid, ...rest } = claims;
  return signJwt(sid === undefined ? { ...rest, exp } : { ...rest, sid, exp }, secret);
}

/** Verifies the signature, parses the claims and checks expiry. Null when any of those fail. */
export async function readClaims(
  token: string,
  secret: string,
  now: number,
): Promise<Claims | null> {
  let payload: Record<string, unknown> | null;
  try {
    payload = await verifyJwt(token, secret);
  } catch {
    return null;
  }
  const parsed = ClaimsSchema.safeParse(payload);
  if (!parsed.success) return null;
  return parsed.data.exp * 1000 > now ? parsed.data : null;
}
