import type { Claims } from "@open-game-system/ogs-protocol";
import { type Context, Hono } from "hono";
import { PEER_HEADER, type Peer } from "../couch-session";
import { apiError } from "../lib/http";
import { readClaims } from "../lib/identity";
import { markSeen } from "../lib/presence";
import { getProfile } from "../lib/profiles";
import { getSession, mayEnter, type SessionRow } from "../lib/sessions";
import type { Env } from "../types";

const couch = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/couch/ws?token=<token>&session=<sid> — WebSocket to a couch session. A launcher
 * token names its own session; a phone or tablet names it in `session` and must be its host or
 * have joined it. The token is a query parameter because browsers can't set WebSocket headers.
 */
couch.get("/ws", async (c) => {
  const claims = await upgradeClaims(c);
  if (claims instanceof Response) return claims;
  const session = await enterableSession(c, claims);
  if (session instanceof Response) return session;

  const headers = new Headers(c.req.raw.headers);
  headers.set(PEER_HEADER, JSON.stringify(await peerOf(c.env.DB, claims, session)));
  const stub = c.env.COUCH_SESSION.get(c.env.COUCH_SESSION.idFromName(session.id));
  return stub.fetch(new Request(c.req.url, { headers }));
});

type CouchContext = Context<{ Bindings: Env }>;

/** The verified claims of a WebSocket upgrade, or the error response. */
async function upgradeClaims(c: CouchContext): Promise<Claims | Response> {
  const token = c.req.query("token");
  if (!token) return apiError(c, 401, "missing_auth", "token query parameter is required");
  const claims = await readClaims(token, c.env.OGS_JWT_SECRET, Date.now());
  if (!claims) return apiError(c, 401, "invalid_token", "Token is invalid or expired");
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
    return apiError(c, 426, "upgrade_required", "Connect with a WebSocket upgrade");
  return claims;
}

/** The session named by `?session=` (or the launcher token) that these claims may enter. */
async function enterableSession(c: CouchContext, claims: Claims): Promise<SessionRow | Response> {
  const sid = c.req.query("session") ?? claims.sid;
  if (!sid) return apiError(c, 400, "missing_session", "session query parameter is required");
  const session = await getSession(c.env.DB, sid);
  if (!session) return apiError(c, 404, "session_not_found", "Session not found");
  if (!(await mayEnter(c.env.DB, claims, session)))
    return apiError(c, 403, "not_a_member", "Join this TV with its code first");
  return session;
}

/** Who is connecting, for the session object (a launcher carries no profile); marks the profile seen. */
async function peerOf(db: D1Database, claims: Claims, session: SessionRow): Promise<Peer> {
  const profile = claims.kind === "launcher" ? null : await getProfile(db, claims.sub);
  if (profile) await markSeen(db, profile.id, Date.now());
  return {
    sessionId: session.id,
    hostProfileId: session.host_profile_id,
    deviceId: claims.did,
    kind: claims.kind,
    profile: profile
      ? { profileId: profile.id, name: profile.name, sticker: profile.sticker }
      : undefined,
  };
}

export default couch;
