import { Hono } from "hono";
import { parseSigningKey, publicJwks } from "../lib/game-token";
import { apiError } from "../lib/http";
import type { Env } from "../types";

const wellKnown = new Hono<{ Bindings: Env }>();

/** GET /.well-known/jwks.json — OGS's public key: games verify their game tokens with it. */
wellKnown.get("/jwks.json", (c) => {
  const key = parseSigningKey(c.env.OGS_GAME_SIGNING_KEY);
  if (!key) return apiError(c, 503, "game_tokens_unavailable", "Game tokens are not configured");
  c.header("Cache-Control", "public, max-age=300");
  return c.json(publicJwks(key));
});

export default wellKnown;
