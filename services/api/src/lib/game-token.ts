import {
  avatarUrl,
  type CouchClaim,
  GAME_TOKEN_TTL_S,
  type GamePlayer,
  type GameToken,
} from "@open-game-system/ogs-protocol";
import { z } from "zod";
import type { Profile } from "./profiles";

/**
 * The private ES256 key OGS signs game tokens with: a P-256 JWK with its `kid`, kept in the Worker
 * secret OGS_GAME_SIGNING_KEY (`pnpm game-key` makes one for .dev.vars).
 */
const SigningKeySchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(1),
  y: z.string().min(1),
  d: z.string().min(1),
  kid: z.string().min(1),
});
export type SigningKey = z.infer<typeof SigningKeySchema>;

/** The secret as a signing key, or null when it is missing or not a private P-256 JWK. */
export function parseSigningKey(raw: string | undefined): SigningKey | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = SigningKeySchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** `GET /.well-known/jwks.json`: the public half only. */
export function publicJwks(key: SigningKey) {
  return {
    keys: [
      { kty: key.kty, crv: key.crv, x: key.x, y: key.y, kid: key.kid, alg: "ES256", use: "sig" },
    ],
  };
}

export const playerOf = (p: Profile, avatarBase: string): GamePlayer => ({
  id: p.id,
  handle: p.handle,
  name: p.name,
  avatar: avatarUrl(avatarBase, p.sticker),
});

/**
 * The claims for one game: built from the profile row only, so a token can never carry friends,
 * other games, device ids, push tokens, the app's own token or age.
 */
export function gameClaims(opts: {
  iss: string;
  appId: string;
  profile: Profile;
  avatarBase: string;
  now: number;
  session?: { sid: string; players: GamePlayer[] };
  /** The couch this token is for (spec §7): the TV's, or a phone's that asked with its session. */
  couch?: CouchClaim;
}): GameToken {
  const iat = Math.floor(opts.now / 1000);
  const { id, handle, name, avatar } = playerOf(opts.profile, opts.avatarBase);
  const base = { iss: opts.iss, aud: opts.appId, sub: id, handle, name, avatar };
  const session = opts.session ? { sid: opts.session.sid, players: opts.session.players } : {};
  const couch = opts.couch ? { couch: { sid: opts.couch.sid, label: opts.couch.label } } : {};
  return { ...base, ...session, ...couch, iat, exp: iat + GAME_TOKEN_TTL_S };
}

const b64url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const jsonPart = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

/** Signs the claims as an ES256 JWT (header names the key's kid). */
export async function signGameToken(claims: GameToken, key: SigningKey): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: key.kty, crv: key.crv, x: key.x, y: key.y, d: key.d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const input = `${jsonPart({ alg: "ES256", typ: "JWT", kid: key.kid })}.${jsonPart(claims)}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${b64url(new Uint8Array(sig))}`;
}
