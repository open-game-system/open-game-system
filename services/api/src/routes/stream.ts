import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { addTracks, createSession, type RealtimeCredentials, renegotiate } from "../lib/realtime";
import { recordError, requestEvent } from "../lib/wide-event";
import {
  type IceServerConfig,
  type PublisherPrepareResponse,
  parsePublisherPrepareResponse,
  parseSessionDescription,
  parseTurnCredentialsResponse,
} from "../protocol";
import type { Env } from "../types";

type StreamEnv = { Bindings: Env };

const stream = new Hono<StreamEnv>();

const TURN_TTL_SECONDS = 300;

/** A secret this Worker needs is missing (reported as `stream_not_configured`). */
class NotConfigured extends Error {
  override name = "NotConfigured";
}

/**
 * The API's error contract (`{ error: { code, message, status } }`), plus the stream routes' trace
 * id and, for a failed stream server step, its own words (`details`).
 */
function streamError(
  c: Context<StreamEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  traceId: string,
  details?: string,
) {
  const extra = details === undefined ? {} : { details };
  const event = requestEvent(c);
  if (status >= 500 && !event.error) event.error = { type: "StreamError", message };
  return c.json({ error: { code, message, status }, ...extra, traceId }, status);
}

/** A thrown step: missing config, or the code of the route that failed. */
function thrown(c: Context<StreamEnv>, error: unknown, code: string, traceId: string) {
  const message = error instanceof Error ? error.message : String(error);
  recordError(c, error);
  return streamError(
    c,
    500,
    error instanceof NotConfigured ? "stream_not_configured" : code,
    message,
    traceId,
  );
}

function getRealtimeCredentials(env: Env): RealtimeCredentials {
  if (!env.CLOUDFLARE_REALTIME_APP_ID || !env.CLOUDFLARE_REALTIME_APP_SECRET) {
    throw new NotConfigured(
      "CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_SECRET must be configured",
    );
  }
  return {
    appId: env.CLOUDFLARE_REALTIME_APP_ID,
    appSecret: env.CLOUDFLARE_REALTIME_APP_SECRET,
  };
}
/** The Cloud Run stream server (`stream-gpu`): the only renderer. */
function streamServerUrl(env: Env): string {
  if (!env.STREAM_SERVER_URL) throw new NotConfigured("STREAM_SERVER_URL must be configured");
  return env.STREAM_SERVER_URL;
}

const SESSION_ID_HEADER = "x-stream-session-id";
const DEBUG_TOKEN_HEADER = "x-debug-token";

/**
 * A stream route's trace: its id (sent to the stream server and back to the caller) and the steps
 * it took, which go in the request's wide event (`trace_id`, `stream_steps`) instead of one log
 * line per step.
 */
type Trace = { id: string; step(name: string, details?: Record<string, unknown>): void };

function streamTrace(c: Context<StreamEnv>): Trace {
  const id = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const steps: Record<string, unknown>[] = [];
  Object.assign(requestEvent(c), { trace_id: id, stream_steps: steps });
  return { id, step: (name, details) => steps.push({ step: name, ...details }) };
}

export function normalizeIceServers(iceServers: IceServerConfig[]): IceServerConfig[] {
  return iceServers
    .map((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      const filteredUrls = urls.filter((url) => {
        const normalizedUrl = url.toLowerCase();
        return !(
          normalizedUrl.includes(":53?") ||
          normalizedUrl.endsWith(":53") ||
          normalizedUrl.includes(":53#") ||
          normalizedUrl.includes(":53/")
        );
      });
      return {
        ...server,
        urls: filteredUrls,
      };
    })
    .filter((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.length > 0;
    });
}

function timingSafeMatches(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < actualBytes.length; i++) {
    result |= actualBytes[i] ^ expectedBytes[i];
  }
  return result === 0;
}

export function isDebugRequestAuthorized(
  debugStateToken: string | undefined,
  providedToken: string | null,
): boolean {
  if (!debugStateToken) {
    return true;
  }

  if (!providedToken) {
    return false;
  }

  return timingSafeMatches(providedToken, debugStateToken);
}

export function resolveSessionId(sessionIdHeader: string | null): string | null {
  if (!sessionIdHeader) {
    return null;
  }

  const normalizedSessionId = sessionIdHeader.trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(normalizedSessionId)) {
    return null;
  }

  return normalizedSessionId;
}

async function generateTurnIceServers(env: Env, trace: Trace): Promise<IceServerConfig[]> {
  const apiToken = env.CLOUDFLARE_TURN_API_TOKEN;
  const turnKeyId = env.CLOUDFLARE_TURN_KEY_ID;

  if (!apiToken || !turnKeyId) {
    throw new Error("TURN credentials are not configured in Worker secrets");
  }

  trace.step("turn_credentials_request_start", { ttlSeconds: TURN_TTL_SECONDS });
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
    },
  );

  const bodyText = await response.text();
  if (!response.ok) {
    trace.step("turn_credentials_request_failed", {
      status: response.status,
      body: bodyText,
    });
    throw new Error(`TURN credentials request failed: ${response.status}`);
  }

  const parsed = parseTurnCredentialsResponse(JSON.parse(bodyText));
  const iceServers = normalizeIceServers(parsed.iceServers);
  trace.step("turn_credentials_request_complete", {
    serverCount: iceServers.length,
  });
  return iceServers;
}

/**
 * Forwards this request to the stream server's bare path (no /api/v1/stream prefix) with its body,
 * content type, session id and a trace id, and passes the answer through. Without
 * STREAM_SERVER_URL: `stream_not_configured`, and nothing is called.
 */
async function forwardToStreamServer(c: Context<StreamEnv>, targetPath: string) {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  let base: string;
  try {
    base = streamServerUrl(c.env);
  } catch (error) {
    return thrown(c, error, "stream_forward_failed", traceId);
  }
  const headers = new Headers({ "x-stream-trace-id": traceId });
  for (const name of ["content-type", SESSION_ID_HEADER]) {
    const value = c.req.header(name);
    if (value) headers.set(name, value);
  }
  const hasBody = c.req.method !== "GET" && c.req.method !== "HEAD";
  return fetch(`${base}${targetPath}`, {
    method: c.req.method,
    headers,
    body: hasBody ? await c.req.text() : undefined,
  });
}

/**
 * POST /api/v1/stream/heartbeat
 * The receiver pings this about once a minute while a TV is casting. The video itself flows to the
 * SFU, not through the stream server, so without it the server looks idle mid-game (Cloud Run may
 * shut it down), and once casting stops the pings stop, letting it scale to zero.
 */
stream.post("/heartbeat", async (c) => {
  let base: string;
  try {
    base = streamServerUrl(c.env);
  } catch (error) {
    const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
    return thrown(c, error, "stream_heartbeat_failed", traceId);
  }
  try {
    const res = await fetch(`${base}/ping`, { method: "GET" });
    // 410: the stream hit its maximum lifetime (a forgotten cast); the receiver stops pinging.
    if (res.status === 410) return c.json({ ok: false, expired: true }, 410);
    return c.json({ ok: res.ok }, res.ok ? 200 : 502);
  } catch {
    return c.json({ ok: false }, 502);
  }
});

/**
 * GET /api/v1/stream/ice-servers
 * Returns TURN credentials for WebRTC connections.
 */
stream.get("/ice-servers", async (c) => {
  const trace = streamTrace(c);
  const traceId = trace.id;
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);

  try {
    const iceServers = await generateTurnIceServers(c.env, trace);
    return c.json({
      iceServers,
      traceId,
      sessionId,
    });
  } catch {
    // TURN not configured — return default STUN servers (SFU provides its own TURN)
    return c.json({
      iceServers: [{ urls: ["stun:stun.cloudflare.com:3478"] }],
      traceId,
      sessionId,
    });
  }
});

/**
 * GET /api/v1/stream/ready
 * Post-deploy readiness (scripts/stream-ready.mjs): which parts a cast needs are configured — the
 * renderer (STREAM_SERVER_URL, the Cloud Run GPU service), Realtime (the SFU) and TURN (the GPU
 * publisher reaches the SFU through it). Booleans only, never values; nothing is called or started.
 */
stream.get("/ready", (c) => {
  const set = (value: unknown) => typeof value === "string" && value.length > 0;
  const renderer = { url: set(c.env.STREAM_SERVER_URL) };
  const realtime =
    set(c.env.CLOUDFLARE_REALTIME_APP_ID) && set(c.env.CLOUDFLARE_REALTIME_APP_SECRET);
  const turn = set(c.env.CLOUDFLARE_TURN_API_TOKEN) && set(c.env.CLOUDFLARE_TURN_KEY_ID);
  const ready = renderer.url && realtime && turn;
  return c.json({ ready, renderer, realtime, turn }, ready ? 200 : 503);
});

/**
 * GET /api/v1/stream/health
 * The stream server's health check (on a scaled-to-zero GPU service this starts an instance).
 */
stream.get("/health", (c) => forwardToStreamServer(c, "/health"));

type ServerPost = (path: string, body: unknown) => Promise<Response>;

/** POSTs JSON to the stream server (STREAM_SERVER_URL). */
function serverPoster(base: string, trace: Trace): ServerPost {
  return (path, body) => {
    const url = `${base}${path}`;
    trace.step("stream_server_fetch", { url });
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-stream-trace-id": trace.id },
      body: JSON.stringify(body),
    });
  };
}

/** TURN servers when configured and reachable, else none. */
async function optionalIceServers(env: Env, trace: Trace): Promise<IceServerConfig[]> {
  try {
    return await generateTurnIceServers(env, trace);
  } catch {
    trace.step("turn_not_configured_using_defaults");
    return [];
  }
}

/** The error body of a failed stream server step (logged), or null when it succeeded. */
async function failure(res: Response, trace: Trace, event: string): Promise<string | null> {
  if (res.ok) return null;
  const body = await res.text();
  trace.step(event, { status: res.status, body });
  return body;
}

/**
 * Steps 5–6: once the PeerConnection is up, push the publisher's tracks to the SFU and apply the
 * renegotiated answer (tracks/new always returns one).
 */
async function publishTracks(
  creds: RealtimeCredentials,
  sfuSessionId: string,
  prepared: PublisherPrepareResponse,
  post: ServerPost,
  trace: Trace,
) {
  // Small delay to ensure PeerConnection is fully established
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const sfuTracks = await addTracks(creds, sfuSessionId, {
    sessionDescription: prepared.sessionDescription,
    tracks: prepared.tracks.map((t) => ({
      location: "local" as const,
      trackName: t.trackName,
      mid: t.mid,
    })),
  });
  trace.step("sfu_tracks_added");
  await post("/publisher/answer", { sessionDescription: sfuTracks.sessionDescription });
  trace.step("publisher_reanswer_applied");
}

/**
 * POST /api/v1/stream/start-stream
 * Two-phase SFU flow:
 * 1. Stream server /publisher/prepare → local SDP offer + track list
 * 2. CF Realtime createSession(offer) → sessionId
 * 3. CF Realtime addTracks(sessionId, offer, tracks) → SFU answer
 * 4. Stream server /publisher/answer → complete WebRTC handshake
 */
stream.post("/start-stream", async (c) => {
  const trace = streamTrace(c);
  const traceId = trace.id;
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);

  try {
    const creds = getRealtimeCredentials(c.env);
    const post = serverPoster(streamServerUrl(c.env), trace);
    trace.step("start_stream_begin", { sessionId });

    // Step 1: Ask the stream server to prepare the publisher (ICE servers optional — SFU provides its own TURN)
    const iceServers = await optionalIceServers(c.env, trace);
    const requestBody = await c.req.json();
    const prepareRes = await post("/publisher/prepare", { url: requestBody.url, iceServers });
    const prepareError = await failure(prepareRes, trace, "publisher_prepare_failed");
    if (prepareError !== null)
      return streamError(
        c,
        500,
        "publisher_prepare_failed",
        "Publisher prepare failed",
        traceId,
        prepareError,
      );
    const prepareData = parsePublisherPrepareResponse(await prepareRes.json());
    trace.step("publisher_prepared", { trackCount: prepareData.tracks.length });

    // Step 2: Create Realtime SFU session with the local offer → get SFU answer
    const sfuSession = await createSession(creds, prepareData.sessionDescription);
    trace.step("sfu_session_created", { sfuSessionId: sfuSession.sessionId });

    // Step 3: Apply SFU answer to the stream server FIRST — PeerConnection must connect before adding tracks
    const answerRes = await post("/publisher/answer", {
      sessionDescription: sfuSession.sessionDescription,
    });
    const answerError = await failure(answerRes, trace, "publisher_answer_failed");
    if (answerError !== null)
      return streamError(
        c,
        500,
        "publisher_answer_failed",
        "Publisher answer failed",
        traceId,
        answerError,
      );

    await publishTracks(creds, sfuSession.sessionId, prepareData, post, trace);
    trace.step("start_stream_complete", { sfuSessionId: sfuSession.sessionId });
    return c.json({
      status: "success",
      traceId,
      publisherSessionId: sfuSession.sessionId,
      tracks: prepareData.tracks,
    });
  } catch (error) {
    trace.step("start_stream_error");
    return thrown(c, error, "stream_start_failed", traceId);
  }
});

/**
 * POST /api/v1/stream/subscribe
 * Create a subscriber Realtime session that pulls the publisher's tracks.
 * Returns the SFU's SDP offer for the receiver to answer.
 */
stream.post("/subscribe", async (c) => {
  const trace = streamTrace(c);
  const traceId = trace.id;

  try {
    const creds = getRealtimeCredentials(c.env);
    const body = await c.req.json();
    const publisherSessionId = body.publisherSessionId;
    if (!publisherSessionId || typeof publisherSessionId !== "string") {
      return streamError(c, 400, "invalid_body", "publisherSessionId is required", traceId);
    }
    const trackNames: string[] = body.trackNames ?? ["cast-video", "cast-audio"];
    trace.step("subscribe_begin", { publisherSessionId, trackNames });

    // Create subscriber session with NO SDP (per CF Realtime example)
    // The SFU generates the offer when we add remote tracks
    const subscriberSession = await createSession(creds);
    trace.step("subscriber_session_created", {
      subscriberSessionId: subscriberSession.sessionId,
    });

    // Pull the publisher's tracks — SFU generates an offer for the subscriber
    const subResult = await addTracks(creds, subscriberSession.sessionId, {
      tracks: trackNames.map((trackName) => ({
        location: "remote" as const,
        trackName,
        sessionId: publisherSessionId,
      })),
    });
    trace.step("subscriber_tracks_added");

    return c.json({
      subscriberSessionId: subscriberSession.sessionId,
      sessionDescription: subResult.sessionDescription,
      traceId,
    });
  } catch (error) {
    trace.step("subscribe_error");
    return thrown(c, error, "subscribe_failed", traceId);
  }
});

/**
 * PUT /api/v1/stream/subscribe/:subscriberSessionId/answer
 * Receiver sends its SDP answer to complete the WebRTC handshake.
 */
stream.put("/subscribe/:subscriberSessionId/answer", async (c) => {
  const trace = streamTrace(c);
  const traceId = trace.id;
  const subscriberSessionId = c.req.param("subscriberSessionId");

  try {
    const creds = getRealtimeCredentials(c.env);
    const body = await c.req.json();
    const sessionDescription = parseSessionDescription(body.sessionDescription);
    trace.step("subscribe_answer_begin", { subscriberSessionId });

    const result = await renegotiate(creds, subscriberSessionId, sessionDescription);
    trace.step("subscribe_answer_complete");

    return c.json({
      status: "success",
      sessionDescription: result.sessionDescription,
      traceId,
    });
  } catch (error) {
    trace.step("subscribe_answer_error");
    return thrown(c, error, "subscribe_answer_failed", traceId);
  }
});

/** POST /api/v1/stream/publisher/prepare: the stream server initializes its publisher (SDP offer). */
stream.post("/publisher/prepare", (c) => forwardToStreamServer(c, "/publisher/prepare"));

/** POST /api/v1/stream/publisher/answer: the SFU's SDP answer to the stream server. */
stream.post("/publisher/answer", (c) => forwardToStreamServer(c, "/publisher/answer"));

/** GET /api/v1/stream/publisher/state: the stream server's publisher state, for debugging. */
stream.get("/publisher/state", (c) => forwardToStreamServer(c, "/publisher/state"));

/**
 * GET /api/v1/stream/debug-state
 * The stream server's debug state. Requires the debug token when DEBUG_STATE_TOKEN is set.
 */
stream.get("/debug-state", (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  if (
    !isDebugRequestAuthorized(c.env.DEBUG_STATE_TOKEN, c.req.header(DEBUG_TOKEN_HEADER) ?? null)
  ) {
    return streamError(c, 403, "forbidden", "A valid x-debug-token is required", traceId);
  }
  return forwardToStreamServer(c, "/debug-state");
});

export default stream;
