import {
  GameNotificationRequestSchema,
  type GameNotificationResult,
  PushConsentRequestSchema,
  type PushConsentResult,
} from "@open-game-system/ogs-protocol";
import { Hono } from "hono";
import { catalogueFor } from "../catalogue";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { deliver } from "../lib/push-delivery";
import { grantOgs } from "../lib/push-handles";
import { pushSenders } from "../lib/push-senders";
import { gameKeyAuth } from "../middleware/game-key-auth";
import { anyToken, deviceOnly, type ProfileEnv } from "../middleware/profile-auth";

/** Game pushes (docs/product-specs/push-notifications.md), mounted at /api/v1/games. */
const push = new Hono<ProfileEnv>();

/** The catalogue game, with any local startUrl override (dev stacks and e2e). */
const findGame = (env: { CATALOGUE_START_URLS?: string }, appId: string) =>
  catalogueFor(env).find((m) => m.appId === appId);

/**
 * POST /games/:appId/push-handles — the app's consent sheet said Allow: `{ handle? }` → the handle
 * that reaches this profile in this game. A kid's iPad (a tablet) is always denied.
 */
push.post("/:appId/push-handles", anyToken, deviceOnly, async (c) => {
  const appId = c.req.param("appId") ?? "";
  if (!findGame(c.env, appId)) return apiError(c, 404, "game_not_found", "No game with that appId");
  const body = await parseBody(c, PushConsentRequestSchema);
  if (!body) return invalidBody(c, "handle must be a push handle");
  const claims = c.get("claims");
  if (claims.kind !== "phone") {
    const denied: PushConsentResult = { status: "denied" };
    return c.json(denied);
  }
  const handle = await grantOgs(c.env.DB, claims.sub, appId, Date.now(), body.handle);
  const granted: PushConsentResult = { status: "granted", handle };
  return c.json(granted);
});

/** True when `url` is on the game's origin (the origin of its startUrl). */
const sameOrigin = (url: string, startUrl: string) => new URL(url).origin === new URL(startUrl).origin;

/**
 * POST /games/:appId/notifications — a game server (its API key) tells players something:
 * `{ to: [handle], title, body, url?, tag?, whenOpen? }` → one status per handle, in order.
 */
push.post("/:appId/notifications", gameKeyAuth, async (c) => {
  const appId = c.req.param("appId") ?? "";
  const game = findGame(c.env, appId);
  if (!game) return apiError(c, 404, "unknown_game", "No game with that appId");
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return invalidBody(c, "Request body must be valid JSON");
  }
  const parsed = GameNotificationRequestSchema.safeParse(raw);
  if (!parsed.success)
    return apiError(c, 400, "missing_fields", "to (1-100 push handles), title (≤ 60) and body (≤ 180) are required");
  const req = parsed.data;
  const url = req.url ?? game.startUrl;
  if (!sameOrigin(url, game.startUrl)) return invalidBody(c, "url must be on the game's origin");
  const message = { appId, title: req.title, body: req.body, url, tag: req.tag, whenOpen: req.whenOpen };
  const senders = pushSenders(c.env);
  const results: GameNotificationResult["results"] = [];
  for (const to of req.to) results.push({ to, status: await deliver(c.env.DB, to, message, senders) });
  const result: GameNotificationResult = { results };
  return c.json(result);
});

export default push;
