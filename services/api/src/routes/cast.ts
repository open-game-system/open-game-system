import { Hono } from "hono";
import { CastStateUpdateSchema, CreateCastSessionSchema } from "../schemas";
import type { CastSessionRow, Env } from "../types";

type CastEnv = { Bindings: Env; Variables: { gameId: string; gameName: string } };

const cast = new Hono<CastEnv>();

/**
 * POST /api/v1/cast/sessions
 * Creates a cast session: provisions a stream-kit container via DO and returns stream details.
 */
cast.post("/sessions", async (c) => {
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "invalid_body", message: "Request body must be valid JSON", status: 400 } },
      400,
    );
  }

  const parsed = CreateCastSessionSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Distinguish between missing fields and invalid viewUrl
    const hasDeviceId = typeof (rawBody as Record<string, unknown>)?.deviceId === "string";
    const hasViewUrl = typeof (rawBody as Record<string, unknown>)?.viewUrl === "string";

    if (hasDeviceId && hasViewUrl) {
      return c.json(
        {
          error: {
            code: "invalid_view_url",
            message: "viewUrl must be a valid HTTPS URL",
            status: 400,
          },
        },
        400,
      );
    }

    return c.json(
      {
        error: {
          code: "missing_fields",
          message: "deviceId and viewUrl (HTTPS) are required",
          status: 400,
        },
      },
      400,
    );
  }

  const { deviceId, viewUrl } = parsed.data;
  const gameId = c.get("gameId");
  const sessionId = crypto.randomUUID();

  // The receiver proxies through the API to reach the stream container.
  // Each cast session gets its own container instance (keyed by sessionId).
  const streamSessionId = sessionId;
  const apiOrigin = new URL(c.req.url).origin;
  const streamUrl = `${apiOrigin}/api/v1/cast/stream/${sessionId}`;

  // Persist session
  await c.env.DB.prepare(
    "INSERT INTO cast_sessions (session_id, game_id, device_id, view_url, stream_session_id, stream_url, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
  )
    .bind(sessionId, gameId, deviceId, viewUrl, streamSessionId, streamUrl)
    .run();

  return c.json(
    {
      sessionId,
      streamSessionId,
      streamUrl,
      status: "active" as const,
    },
    201,
  );
});

/**
 * GET /api/v1/cast/sessions/:id
 * Returns the status of a cast session.
 */
cast.get("/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const gameId = c.get("gameId");

  const session = await c.env.DB.prepare("SELECT * FROM cast_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<CastSessionRow>();

  if (!session || session.game_id !== gameId) {
    return c.json(
      { error: { code: "session_not_found", message: "Cast session not found", status: 404 } },
      404,
    );
  }

  return c.json({
    sessionId: session.session_id,
    status: session.status,
    streamSessionId: session.stream_session_id,
    streamUrl: session.stream_url,
  });
});

/**
 * POST /api/v1/cast/sessions/:id/state
 * Pushes a game state update to the stream-kit container via DO.
 */
cast.post("/sessions/:id/state", async (c) => {
  const sessionId = c.req.param("id");
  const gameId = c.get("gameId");

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(
      { error: { code: "invalid_body", message: "Request body must be valid JSON", status: 400 } },
      400,
    );
  }

  const parsed = CastStateUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      { error: { code: "missing_fields", message: "state object is required", status: 400 } },
      400,
    );
  }

  const session = await c.env.DB.prepare("SELECT * FROM cast_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<CastSessionRow>();

  if (
    !session ||
    session.game_id !== gameId ||
    (session.status !== "active" && session.status !== "idle")
  ) {
    return c.json(
      {
        error: { code: "session_not_found", message: "Active cast session not found", status: 404 },
      },
      404,
    );
  }

  // Reactivate idle session on state push
  if (session.status === "idle") {
    await c.env.DB.prepare(
      "UPDATE cast_sessions SET status = 'active', updated_at = datetime('now') WHERE session_id = ?",
    )
      .bind(sessionId)
      .run();
  }

  // Forward state to stream container (best effort)
  try {
    const container = c.env.STREAM_CONTAINER.get(
      c.env.STREAM_CONTAINER.idFromName(session.stream_session_id!),
    );
    await container.fetch("http://container/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
  } catch {
    // Best effort — state forwarding failure doesn't break the API response
  }

  return c.json({ status: "ok" });
});

/**
 * DELETE /api/v1/cast/sessions/:id
 * Ends a cast session and tears down the stream-kit container via DO.
 */
cast.delete("/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const gameId = c.get("gameId");

  const session = await c.env.DB.prepare("SELECT * FROM cast_sessions WHERE session_id = ?")
    .bind(sessionId)
    .first<CastSessionRow>();

  if (!session || session.game_id !== gameId) {
    return c.json(
      { error: { code: "session_not_found", message: "Cast session not found", status: 404 } },
      404,
    );
  }

  // Already ended — idempotent
  if (session.status === "ended") {
    return c.json({ status: "ended" as const });
  }

  // The container will auto-sleep via sleepAfter config.
  // No explicit teardown needed — the Container class handles lifecycle.

  // Mark session as ended
  await c.env.DB.prepare(
    "UPDATE cast_sessions SET status = 'ended', updated_at = datetime('now') WHERE session_id = ?",
  )
    .bind(sessionId)
    .run();

  return c.json({ status: "ended" as const });
});

/**
 * ALL /api/v1/cast/stream/:sessionId/*
 * Proxies requests from the cast receiver to the stream container.
 * The receiver calls /start-stream, /ice-servers, etc. through this proxy.
 * No API key required — the receiver on Chromecast doesn't have one.
 */
cast.all("/stream/:sessionId/*", async (c) => {
  const sessionId = c.req.param("sessionId");
  const originalUrl = new URL(c.req.url);
  const proxyPath = originalUrl.pathname.replace(`/api/v1/cast/stream/${sessionId}`, "");

  // Rewrite URL to stream route and add session ID header
  const streamUrl = new URL(originalUrl);
  streamUrl.pathname = `/api/v1/stream${proxyPath || "/health"}`;

  const headers = new Headers(c.req.raw.headers);
  headers.set("x-stream-session-id", sessionId);

  // Forward to this same Worker — Hono will route to the stream handler
  const hasBody = c.req.method !== "GET" && c.req.method !== "HEAD";
  const internalReq = new Request(streamUrl.toString(), {
    method: c.req.method,
    headers,
    body: hasBody ? c.req.raw.body : undefined,
    ...(hasBody ? { duplex: "half" as const } : {}),
  } as RequestInit);

  // Self-fetch routes through the Hono app
  return fetch(internalReq);
});

export default cast;
