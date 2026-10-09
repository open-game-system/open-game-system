import { Hono } from "hono";
import { grantedGames, markOgsActive, revokeGrant } from "../lib/push-handles";
import { deviceOnly, type ProfileEnv } from "../middleware/profile-auth";

/** The app's notification settings. Mounted at /api/v1/me, behind anyToken; the device only. */
const pushSettings = new Hono<ProfileEnv>();
pushSettings.use("/push-grants", deviceOnly);
pushSettings.use("/push-grants/*", deviceOnly);
pushSettings.use("/push-active/*", deviceOnly);

/** GET /me/push-grants — the games this profile lets notify it: `{ games: [appId] }`. */
pushSettings.get("/push-grants", async (c) =>
  c.json({ games: await grantedGames(c.env.DB, c.get("claims").sub) }),
);

/** DELETE /me/push-grants/:appId — Settings turned the game off. */
pushSettings.delete("/push-grants/:appId", async (c) => {
  await revokeGrant(c.env.DB, c.get("claims").sub, c.req.param("appId"), Date.now());
  return c.json({ ok: true });
});

/** POST /me/push-active/:appId — the game opened in the app: its app surface is the most recent. */
pushSettings.post("/push-active/:appId", async (c) => {
  await markOgsActive(c.env.DB, c.get("claims").sub, c.req.param("appId"), Date.now());
  return c.json({ ok: true });
});

export default pushSettings;
