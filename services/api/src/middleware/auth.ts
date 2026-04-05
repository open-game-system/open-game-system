import type { Context, Next } from "hono";
import type { Env } from "../types";

type AuthEnv = { Bindings: Env; Variables: { gameId: string; gameName: string } };

/**
 * Middleware that validates the API key from the Authorization header
 * against the api_keys table in D1.
 */
export async function apiKeyAuth(c: Context<AuthEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json(
      { error: { code: "missing_auth", message: "Authorization header is required", status: 401 } },
      401,
    );
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return c.json(
      {
        error: {
          code: "invalid_auth",
          message: "Authorization header must use Bearer scheme",
          status: 401,
        },
      },
      401,
    );
  }

  const apiKey = match[1];
  const result = await c.env.DB.prepare(
    "SELECT key, game_id, game_name FROM api_keys WHERE key = ?",
  )
    .bind(apiKey)
    .first();

  if (!result) {
    return c.json(
      {
        error: { code: "invalid_api_key", message: "The provided API key is invalid", status: 401 },
      },
      401,
    );
  }

  // Attach game info to the context for downstream handlers
  c.set("gameId", result.game_id as string);
  c.set("gameName", result.game_name as string);

  await next();
}
