import { Hono } from "hono";
import { CLAIMS_HEADER } from "../couch-session";
import { apiError } from "../lib/http";
import { readClaims } from "../lib/identity";
import type { Env } from "../types";

const couch = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/couch/ws?token=<household token> — WebSocket to the household's couch session.
 * The token is a query parameter because browsers cannot set headers on a WebSocket.
 */
couch.get("/ws", async (c) => {
  const token = c.req.query("token");
  if (!token) return apiError(c, 401, "missing_auth", "token query parameter is required");
  const claims = await readClaims(token, c.env.OGS_JWT_SECRET, Date.now());
  if (!claims) return apiError(c, 401, "invalid_token", "Token is invalid or expired");
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
    return apiError(c, 426, "upgrade_required", "Connect with a WebSocket upgrade");

  const headers = new Headers(c.req.raw.headers);
  headers.set(CLAIMS_HEADER, JSON.stringify(claims));
  const stub = c.env.COUCH_SESSION.get(c.env.COUCH_SESSION.idFromName(claims.hid));
  return stub.fetch(new Request(c.req.url, { headers }));
});

export default couch;
