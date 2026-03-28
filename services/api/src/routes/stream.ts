import { Hono } from "hono";
import type { Env } from "../types";
import {
  parseTurnCredentialsResponse,
  type IceServerConfig,
} from "../protocol";

type StreamEnv = { Bindings: Env };

const stream = new Hono<StreamEnv>();

const TURN_TTL_SECONDS = 300;
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
 * Start a streaming session — forwards to the StreamContainer DO.
 */
stream.post("/start-stream", async (c) => {
  const traceId = c.req.header("x-stream-trace-id") || crypto.randomUUID();
  const sessionId = resolveSessionId(c.req.header(SESSION_ID_HEADER) ?? null);
  const streamInstanceName = sessionId ? `session-${sessionId}` : "default-singleton-debug-v3";

  const id = c.env.STREAM_CONTAINER.idFromName(streamInstanceName);
  const stub = c.env.STREAM_CONTAINER.get(id);
  // Rewrite URL to strip the /api/v1/stream prefix — container expects /start-stream
  const containerUrl = new URL(c.req.url);
  containerUrl.pathname = "/start-stream";
  const forwardedRequest = new Request(containerUrl.toString(), {
    method: c.req.method,
    headers: new Headers(c.req.raw.headers),
  });
  forwardedRequest.headers.set("x-stream-trace-id", traceId);

  const response = await stub.fetch(forwardedRequest);
  return response;
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
