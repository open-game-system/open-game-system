import { Hono, type Context } from "hono";
import type { Env } from "../types";
import {
  parseTurnCredentialsResponse,
  parsePublisherPrepareResponse,
  parseSubscribeAnswerRequest,
  type IceServerConfig,
  type SessionDescription,
} from "../protocol";
import {
  createSession,
  addTracks,
  renegotiate,
  type RealtimeCredentials,
} from "../lib/realtime";

type StreamEnv = { Bindings: Env };

const stream = new Hono<StreamEnv>();

const TURN_TTL_SECONDS = 300;

function getRealtimeCredentials(env: Env): RealtimeCredentials {
  if (!env.CLOUDFLARE_REALTIME_APP_ID || !env.CLOUDFLARE_REALTIME_APP_SECRET) {
    throw new Error("CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_SECRET must be configured");
  }
  return {
    appId: env.CLOUDFLARE_REALTIME_APP_ID,
    appSecret: env.CLOUDFLARE_REALTIME_APP_SECRET,
  };
}
const SESSION_ID_HEADER = "x-stream-session-id";
const DEBUG_TOKEN_HEADER = "x-debug-token";

function logTrace(traceId: string, event: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[trace:${traceId}] ${event}`, details);
    return;
  }
  console.log(`[trace:${traceId}] ${event}`);
}

export function normalizeIceServers(iceServers: IceServerConfig[]): IceServerConfig[] {
  return iceServers.map((server) => {
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
  }).filter((server) => {
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

export function isDebugRequestAuthorized(debugStateToken: string | undefined, providedToken: string | null): boolean {
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

async function generateTurnIceServers(
  env: Env,
  traceId: string
): Promise<IceServerConfig[]> {
  const apiToken = env.CLOUDFLARE_TURN_API_TOKEN;
  const turnKeyId = env.CLOUDFLARE_TURN_KEY_ID;

  if (!apiToken || !turnKeyId) {
    throw new Error("TURN credentials are not configured in Worker secrets");
  }

  logTrace(traceId, "turn_credentials_request_start", { ttlSeconds: TURN_TTL_SECONDS });
  const response = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/generate-ice-servers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
    }
  );

  const bodyText = await response.text();
  if (!response.ok) {
    logTrace(traceId, "turn_credentials_request_failed", {
      status: response.status,
      body: bodyText,
    });
    throw new Error(`TURN credentials request failed: ${response.status}`);
  }

  const parsed = parseTurnCredentialsResponse(JSON.parse(bodyText));
  const iceServers = normalizeIceServers(parsed.iceServers);
  logTrace(traceId, "turn_credentials_request_complete", {
    serverCount: iceServers.length,
  });
  return iceServers;
}

function forwardToContainer(c: Context<StreamEnv>, targetPath: string) {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);
  const streamInstanceName = sessionId ? `session-${sessionId}` : "default-singleton-debug-v3";

  const id = c.env.STREAM_CONTAINER.idFromName(streamInstanceName);
  const stub = c.env.STREAM_CONTAINER.get(id);
  const containerUrl = new URL(c.req.url);
  containerUrl.pathname = targetPath;
  const hasBody = c.req.method !== "GET" && c.req.method !== "HEAD";
  const forwardedRequest = new Request(containerUrl.toString(), {
    method: c.req.method,
    headers: new Headers(c.req.raw.headers),
    body: hasBody ? c.req.raw.body : undefined,
    ...(hasBody ? { duplex: "half" as const } : {}),
  } as RequestInit);
  forwardedRequest.headers.set("x-stream-trace-id", traceId);

  return stub.fetch(forwardedRequest);
}

/**
 * GET /api/v1/stream/ice-servers
 * Returns TURN credentials for WebRTC connections.
 */
stream.get("/ice-servers", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);

  try {
    const iceServers = await generateTurnIceServers(c.env, traceId);
    return c.json({
      iceServers,
      traceId,
      sessionId,
    });
  } catch (error) {
    return c.json(
      { error: (error as Error).message, traceId, sessionId },
      500,
    );
  }
});

/**
 * GET /api/v1/stream/health
 * Container health check — forwards to the StreamContainer DO.
 */
stream.get("/health", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);
  const streamInstanceName = sessionId ? `session-${sessionId}` : "default-singleton-debug-v3";

  const id = c.env.STREAM_CONTAINER.idFromName(streamInstanceName);
  const stub = c.env.STREAM_CONTAINER.get(id);
  // Rewrite URL to strip the /api/v1/stream prefix — container expects bare paths
  const containerUrl = new URL(c.req.url);
  containerUrl.pathname = "/health";
  const forwardedRequest = new Request(containerUrl.toString(), {
    method: c.req.method,
    headers: new Headers(c.req.raw.headers),
  });
  forwardedRequest.headers.set("x-stream-trace-id", traceId);

  const response = await stub.fetch(forwardedRequest);
  return response;
});

/**
 * POST /api/v1/stream/start-stream
 * Two-phase SFU flow:
 * 1. Container /publisher/prepare → local SDP offer + track list
 * 2. CF Realtime createSession(offer) → sessionId
 * 3. CF Realtime addTracks(sessionId, offer, tracks) → SFU answer
 * 4. Container /publisher/answer → complete WebRTC handshake
 */
stream.post("/start-stream", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);
  const streamInstanceName = sessionId ? `session-${sessionId}` : "default-singleton-debug-v3";

  try {
    const creds = getRealtimeCredentials(c.env);
    logTrace(traceId, "start_stream_begin", { sessionId, streamInstanceName });

    // Step 1: Ask container to prepare publisher (launch Chrome, capture tab, create local SDP offer)
    const id = c.env.STREAM_CONTAINER.idFromName(streamInstanceName);
    const stub = c.env.STREAM_CONTAINER.get(id);

    const iceServers = await generateTurnIceServers(c.env, traceId);
    const prepareUrl = new URL(c.req.url);
    prepareUrl.pathname = "/publisher/prepare";
    const prepareReq = new Request(prepareUrl.toString(), {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "x-stream-trace-id": traceId }),
      body: JSON.stringify({ url: (await c.req.json()).url, iceServers }),
    });
    const prepareRes = await stub.fetch(prepareReq);
    if (!prepareRes.ok) {
      const errBody = await prepareRes.text();
      logTrace(traceId, "publisher_prepare_failed", { status: prepareRes.status, body: errBody });
      return c.json({ error: "Publisher prepare failed", details: errBody, traceId }, 500);
    }
    const prepareData = parsePublisherPrepareResponse(await prepareRes.json());
    logTrace(traceId, "publisher_prepared", { trackCount: prepareData.tracks.length });

    // Step 2: Create Realtime SFU session with the local offer
    const sfuSession = await createSession(creds, prepareData.sessionDescription);
    logTrace(traceId, "sfu_session_created", { sfuSessionId: sfuSession.sessionId });

    // Step 3: Add tracks to the SFU session
    const sfuTracks = await addTracks(creds, sfuSession.sessionId, {
      sessionDescription: prepareData.sessionDescription,
      tracks: prepareData.tracks.map((t) => ({
        location: "local" as const,
        trackName: t.trackName,
        mid: t.mid,
      })),
    });
    logTrace(traceId, "sfu_tracks_added");

    // Step 4: Send SFU answer back to container to complete WebRTC handshake
    const answerUrl = new URL(c.req.url);
    answerUrl.pathname = "/publisher/answer";
    const answerReq = new Request(answerUrl.toString(), {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "x-stream-trace-id": traceId }),
      body: JSON.stringify({ sessionDescription: sfuTracks.sessionDescription }),
    });
    const answerRes = await stub.fetch(answerReq);
    if (!answerRes.ok) {
      const errBody = await answerRes.text();
      logTrace(traceId, "publisher_answer_failed", { status: answerRes.status, body: errBody });
      return c.json({ error: "Publisher answer failed", details: errBody, traceId }, 500);
    }

    logTrace(traceId, "start_stream_complete", { sfuSessionId: sfuSession.sessionId });
    return c.json({
      status: "success",
      traceId,
      publisherSessionId: sfuSession.sessionId,
      tracks: prepareData.tracks,
    });
  } catch (error) {
    logTrace(traceId, "start_stream_error", { message: (error as Error).message });
    return c.json({ error: (error as Error).message, traceId }, 500);
  }
});

/**
 * POST /api/v1/stream/subscribe
 * Create a subscriber Realtime session that pulls the publisher's tracks.
 * Returns the SFU's SDP offer for the receiver to answer.
 */
stream.post("/subscribe", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();

  try {
    const creds = getRealtimeCredentials(c.env);
    const body = await c.req.json();
    const publisherSessionId = body.publisherSessionId;
    if (!publisherSessionId || typeof publisherSessionId !== "string") {
      return c.json({ error: "publisherSessionId is required", traceId }, 400);
    }
    const trackNames: string[] = body.trackNames ?? ["cast-video", "cast-audio"];
    logTrace(traceId, "subscribe_begin", { publisherSessionId, trackNames });

    // Create a new subscriber session (empty offer to start)
    const subscriberSession = await createSession(creds, { type: "offer", sdp: "" });
    logTrace(traceId, "subscriber_session_created", { subscriberSessionId: subscriberSession.sessionId });

    // Subscribe to the publisher's tracks
    const subResult = await addTracks(creds, subscriberSession.sessionId, {
      sessionDescription: subscriberSession.sessionDescription,
      tracks: trackNames.map((trackName) => ({
        location: "remote" as const,
        trackName,
        sessionId: publisherSessionId,
      })),
    });
    logTrace(traceId, "subscriber_tracks_added");

    return c.json({
      subscriberSessionId: subscriberSession.sessionId,
      sessionDescription: subResult.sessionDescription,
      traceId,
    });
  } catch (error) {
    logTrace(traceId, "subscribe_error", { message: (error as Error).message });
    return c.json({ error: (error as Error).message, traceId }, 500);
  }
});

/**
 * PUT /api/v1/stream/subscribe/:subscriberSessionId/answer
 * Receiver sends its SDP answer to complete the WebRTC handshake.
 */
stream.put("/subscribe/:subscriberSessionId/answer", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const subscriberSessionId = c.req.param("subscriberSessionId");

  try {
    const creds = getRealtimeCredentials(c.env);
    const body = parseSubscribeAnswerRequest(await c.req.json());
    logTrace(traceId, "subscribe_answer_begin", { subscriberSessionId });

    const result = await renegotiate(creds, subscriberSessionId, body.sessionDescription);
    logTrace(traceId, "subscribe_answer_complete");

    return c.json({
      status: "success",
      sessionDescription: result.sessionDescription,
      traceId,
    });
  } catch (error) {
    logTrace(traceId, "subscribe_answer_error", { message: (error as Error).message });
    return c.json({ error: (error as Error).message, traceId }, 500);
  }
});

/**
 * POST /api/v1/stream/publisher/prepare
 * Forwards to the StreamContainer DO → container to initialize publisher and get local SDP offer.
 */
stream.post("/publisher/prepare", async (c) => {
  return forwardToContainer(c, "/publisher/prepare");
});

/**
 * POST /api/v1/stream/publisher/answer
 * Forwards the SFU's SDP answer to the StreamContainer DO → container to complete WebRTC handshake.
 */
stream.post("/publisher/answer", async (c) => {
  return forwardToContainer(c, "/publisher/answer");
});

/**
 * GET /api/v1/stream/publisher/state
 * Forwards to the StreamContainer DO → container for publisher debug state.
 */
stream.get("/publisher/state", async (c) => {
  return forwardToContainer(c, "/publisher/state");
});

/**
 * GET /api/v1/stream/debug-state
 * Debug endpoint — returns container state. Requires debug token if configured.
 */
stream.get("/debug-state", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);
  const streamInstanceName = sessionId ? `session-${sessionId}` : "default-singleton-debug-v3";

  if (!isDebugRequestAuthorized(c.env.DEBUG_STATE_TOKEN, c.req.header(DEBUG_TOKEN_HEADER) ?? null)) {
    return c.json({ error: "Forbidden", traceId }, 403);
  }

  const id = c.env.STREAM_CONTAINER.idFromName(streamInstanceName);
  const stub = c.env.STREAM_CONTAINER.get(id);
  // Rewrite URL to strip the /api/v1/stream prefix — container expects /debug-state
  const containerUrl = new URL(c.req.url);
  containerUrl.pathname = "/debug-state";
  const forwardedRequest = new Request(containerUrl.toString(), {
    method: c.req.method,
    headers: new Headers(c.req.raw.headers),
  });
  forwardedRequest.headers.set("x-stream-trace-id", traceId);

  const response = await stub.fetch(forwardedRequest);
  return response;
});

export default stream;
