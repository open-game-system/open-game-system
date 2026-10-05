import type { CouchClaim, GamePlayer } from "@open-game-system/ogs-protocol";
import type { Context } from "hono";
import { z } from "zod";
import { findManifest } from "../catalogue";
import type { ProfileEnv } from "../middleware/profile-auth";
import type { Env } from "../types";
import { gameClaims, parseSigningKey, playerOf, signGameToken } from "./game-token";
import { apiError } from "./http";
import { type Profile, ProfileSchema } from "./profiles";

/** Where the painted stickers live (the launcher serves /art); a Worker var. */
export const DEFAULT_AVATAR_BASE_URL = "https://tv.opengame.org";
export const avatarBase = (env: Env) => env.AVATAR_BASE_URL || DEFAULT_AVATAR_BASE_URL;

export type Grant = { token: string; expiresAt: number };

/**
 * Signs a game token for `appId`, or answers the error: 404 game_not_found for an app outside the
 * catalogue, 503 game_tokens_unavailable when the signing key isn't configured.
 */
export async function grantFor(
  c: Context<ProfileEnv>,
  appId: string,
  profile: Profile,
  session?: { sid: string; players: GamePlayer[] },
  couch?: CouchClaim,
): Promise<Grant | Response> {
  if (!findManifest(appId)) return apiError(c, 404, "game_not_found", "No game with that appId");
  const key = parseSigningKey(c.env.OGS_GAME_SIGNING_KEY);
  if (!key) return apiError(c, 503, "game_tokens_unavailable", "Game tokens are not configured");
  const claims = gameClaims({
    iss: new URL(c.req.url).origin,
    appId,
    profile,
    avatarBase: avatarBase(c.env),
    now: Date.now(),
    session,
    couch,
  });
  return { token: await signGameToken(claims, key), expiresAt: claims.exp * 1000 };
}

/** The couch: the host, then everyone who joined (oldest first). */
export async function couchOf(db: D1Database, sid: string, hostId: string): Promise<Profile[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.handle, p.name, p.sticker FROM profiles p
       LEFT JOIN session_members sm ON sm.profile_id = p.id AND sm.session_id = ?1
       WHERE p.id = ?2 OR sm.session_id IS NOT NULL
       ORDER BY p.id != ?2, sm.joined_at`,
    )
    .bind(sid, hostId)
    .all();
  return z.array(ProfileSchema).parse(results);
}

export const playersOf = (env: Env, couch: Profile[]) =>
  couch.map((p) => playerOf(p, avatarBase(env)));
