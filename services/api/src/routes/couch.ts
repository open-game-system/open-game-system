import { Hono } from "hono";
import { type Peer, PEER_HEADER } from "../couch-session";
import { apiError } from "../lib/http";
import { readClaims } from "../lib/identity";
import { getProfile } from "../lib/profiles";
import { getSession, mayEnter } from "../lib/sessions";
import type { Env } from "../types";

const couch = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/couch/ws?token=<token>&session=<sid> — WebSocket to a couch session. A launcher
 * token names its own session; a phone or tablet names it in `session` and must be its host or
 * have joined it. The token is a query parameter because browsers can't set WebSocket headers.
 */
couch.get("/ws", async (c) => {
  const token = c.req.query("token");
  if (!token) return apiError(c, 401, "missing_auth", "token query parameter is required");
  const claims = await readClaims(token, c.env.OGS_JWT_SECRET, Date.now());
  if (!claims) return apiError(c, 401, "invalid_token", "Token is invalid or expired");
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
    return apiError(c, 426, "upgrade_required", "Connect with a WebSocket upgrade");
  const sid = c.req.query("session") ?? claims.sid;
  if (!sid) return apiError(c, 400, "missing_session", "session query parameter is required");

  const db = c.env.DB;
  const session = await getSession(db, sid);
  if (!session) return apiError(c, 404, "session_not_found", "Session not found");
  if (!(await mayEnter(db, claims, session)))
    return apiError(c, 403, "not_a_member", "Join this TV with its code first");
  const profile = claims.kind === "launcher" ? null : await getProfile(db, claims.sub);
  const peer: Peer = {
    sessionId: session.id,
    hostProfileId: session.host_profile_id,
    deviceId: claims.did,
    kind: claims.kind,
    profile: profile
      ? { profileId: profile.id, name: profile.name, sticker: profile.sticker }
      : undefined,
  };

  const headers = new Headers(c.req.raw.headers);
  headers.set(PEER_HEADER, JSON.stringify(peer));
  const stub = c.env.COUCH_SESSION.get(c.env.COUCH_SESSION.idFromName(session.id));
  return stub.fetch(new Request(c.req.url, { headers }));
});

export default couch;
