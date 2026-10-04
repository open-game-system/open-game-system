import { Hono } from "hono";
import { grantFor, playersOf } from "../lib/game-grants";
import { apiError } from "../lib/http";
import { getProfile } from "../lib/profiles";
import { anyToken, deviceOnly, type ProfileEnv } from "../middleware/profile-auth";

/** Games know who you are (slice 3). Mounted at /api/v1/games. */
const games = new Hono<ProfileEnv>();
games.use("*", anyToken);

/**
 * POST /games/:appId/token — the OGS app's WebView asks for its profile's token for one game:
 * `{ token, profile: { id, handle, name, avatar }, expiresAt }` (ES256, aud = appId, 1 h).
 */
games.post("/:appId/token", deviceOnly, async (c) => {
  const profile = await getProfile(c.env.DB, c.get("claims").sub);
  if (!profile) return apiError(c, 404, "profile_not_found", "Profile not found");
  const appId = c.req.param("appId") ?? "";
  const grant = await grantFor(c, appId, profile);
  if (grant instanceof Response) return grant;
  const [player] = playersOf(c.env, [profile]);
  return c.json({ ...grant, profile: player });
});

export default games;
