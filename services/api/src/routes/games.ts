import {
  GameInviteRequestSchema,
  type GameInviteResult,
  playLink,
} from "@open-game-system/ogs-protocol";
import { Hono } from "hono";
import { z } from "zod";
import { findManifest } from "../catalogue";
import { areFriends } from "../lib/friends";
import { grantFor, playersOf } from "../lib/game-grants";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { getProfile } from "../lib/profiles";
import { getSession, mayEnter, SESSION_TTL_MS } from "../lib/sessions";
import { anyToken, deviceOnly, type ProfileEnv } from "../middleware/profile-auth";
import { getProviderForPlatform } from "../providers/push";

/** Games know who you are (slice 3). Mounted at /api/v1/games. */
const games = new Hono<ProfileEnv>();
games.use("*", anyToken);

/** Optional body: the couch session this phone is on, so the token names its couch (spec §7). */
const TokenBody = z.object({ sid: z.string().min(1).optional() });

/** The body, `{}` when there is none, or null when it is there but not a TokenBody. */
async function tokenBody(raw: string): Promise<z.infer<typeof TokenBody> | null> {
  if (raw.trim() === "") return {};
  try {
    const parsed = TokenBody.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * POST /games/:appId/token — the OGS app's WebView asks for its profile's token for one game:
 * `{ token, profile: { id, handle, name, avatar }, expiresAt }` (ES256, aud = appId, 1 h). With
 * `{ sid }` (a couch this profile is on) the token also carries `couch: { sid, label }`.
 */
games.post("/:appId/token", deviceOnly, async (c) => {
  const body = await tokenBody(await c.req.text());
  if (!body) return invalidBody(c, "sid must be a couch session id");
  const db = c.env.DB;
  const profile = await getProfile(db, c.get("claims").sub);
  if (!profile) return apiError(c, 404, "profile_not_found", "Profile not found");
  let couch: { sid: string; label: string } | undefined;
  if (body.sid) {
    const row = await getSession(db, body.sid);
    const host =
      row &&
      row.created_at > Date.now() - SESSION_TTL_MS &&
      (await getProfile(db, row.host_profile_id));
    if (!row || !host) return apiError(c, 404, "session_not_found", "Session not found");
    if (!(await mayEnter(db, c.get("claims"), row)))
      return apiError(c, 403, "not_a_member", "Join this TV with its code first");
    couch = { sid: row.id, label: host.name };
  }
  const appId = c.req.param("appId") ?? "";
  const grant = await grantFor(c, appId, profile, undefined, couch);
  if (grant instanceof Response) return grant;
  const [player] = playersOf(c.env, [profile]);
  return c.json({ ...grant, profile: player });
});

/** Game invite links: `<base>/play/<appId>?room=` (a Worker var). */
export const DEFAULT_PLAY_BASE_URL = "https://opengame.org";

/** Pushes to every device of the profile that registered a push token; true if one took it. */
async function pushTo(
  db: D1Database,
  profileId: string,
  notification: { title: string; body: string; data: Record<string, string> },
): Promise<boolean> {
  const { results } = await db
    .prepare(
      `SELECT d.platform, d.push_token FROM devices d
       JOIN profile_devices pd ON pd.device_id = d.ogs_device_id WHERE pd.profile_id = ?`,
    )
    .bind(profileId)
    .all();
  const devices = z
    .array(z.object({ platform: z.enum(["ios", "android"]), push_token: z.string() }))
    .parse(results);
  const sent = await Promise.all(
    devices.map((d) =>
      getProviderForPlatform(d.platform)
        .send(d.push_token, notification)
        .then((r) => r.success)
        .catch(() => false),
    ),
  );
  return sent.some(Boolean);
}

/**
 * POST /games/:appId/invites — "Invite friends to this game" (spec §7): `{ room, to }` → a push to
 * each friend and the play link. multiCouch games only; every `to` must be a friend.
 */
games.post("/:appId/invites", deviceOnly, async (c) => {
  const body = await parseBody(c, GameInviteRequestSchema);
  if (!body)
    return invalidBody(c, "room (the game's room) and to (friends' profile ids) are required");
  const appId = c.req.param("appId") ?? "";
  const game = findManifest(appId);
  if (!game) return apiError(c, 404, "game_not_found", "No game with that appId");
  if (game.multiCouch !== true)
    return apiError(c, 409, "not_multi_couch", "This game is played on one couch");
  const db = c.env.DB;
  const me = await getProfile(db, c.get("claims").sub);
  if (!me) return apiError(c, 404, "profile_not_found", "Profile not found");
  const to = [...new Set(body.to)];
  for (const id of to)
    if (!(await areFriends(db, me.id, id)))
      return apiError(c, 403, "not_a_friend", "You can only invite your friends");
  const link = playLink(c.env.PLAY_BASE_URL || DEFAULT_PLAY_BASE_URL, appId, body.room);
  const notification = {
    title: game.name,
    body: `${me.name} invites you to ${game.name}`,
    data: { type: "game-invite", appId, room: body.room, url: link },
  };
  const invited = await Promise.all(
    to.map(async (profileId) => ({ profileId, pushed: await pushTo(db, profileId, notification) })),
  );
  const result: GameInviteResult = { link, invited };
  return c.json(result, 201);
});

export default games;
