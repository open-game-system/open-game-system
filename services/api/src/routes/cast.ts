import { Hono } from "hono";
import type { Env, CastSessionRow } from "../types";
import { CreateCastSessionSchema, CastStateUpdateSchema } from "../schemas";

type CastEnv = { Bindings: Env; Variables: { gameId: string; gameName: string } };

const cast = new Hono<CastEnv>();

/**
 * POST /api/v1/cast/sessions
 * Creates a cast session: provisions a stream-kit container and returns stream details.
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
        { error: { code: "invalid_view_url", message: "viewUrl must be a valid HTTPS URL", status: 400 } },
        400,
      );
    }

    return c.json(
      { error: { code: "missing_fields", message: "deviceId and viewUrl (HTTPS) are required", status: 400 } },
      400,
    );
  }

  const { deviceId, viewUrl } = parsed.data;
  const gameId = c.get("gameId");
  const sessionId = crypto.randomUUID();

  // Provision stream-kit container
  const streamServerUrl = (c.env as Env & { STREAM_SERVER_URL?: string }).STREAM_SERVER_URL;
  let streamSessionId: string;
  let streamUrl: string;

  try {
    const receiverPeerId = crypto.randomUUID();
    const streamRes = await fetch(`${streamServerUrl}/start-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: viewUrl,
        peerId: receiverPeerId,
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      }),
    });

    if (!streamRes.ok) {
      const errText = await streamRes.text().catch(() => "");
      return c.json(
        { error: { code: "stream_provisioning_failed", message: `Failed to provision stream container: ${errText}`, status: 502 } },
        502,
      );
    }

    const streamData = (await streamRes.json()) as {
      status?: string;
      srcPeerId?: string;
      browserWSEndpoint?: string;
    };
    if (streamData.status !== "success" || !streamData.srcPeerId) {
      return c.json(
        { error: { code: "stream_provisioning_failed", message: "Invalid response from stream server", status: 502 } },
        502,
      );
    }
    streamSessionId = streamData.srcPeerId;
    // Construct WebSocket signaling URL from stream server
    const wsBase = streamServerUrl.replace(/^http/, "ws");
    streamUrl = `${wsBase}/stream/${streamSessionId}/ws`;
  } catch (err) {
    return c.json(
      { error: { code: "stream_provisioning_failed", message: `Failed to reach stream server: ${err instanceof Error ? err.message : "unknown"}`, status: 502 } },
      502,
    );
  }

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

  const session = await c.env.DB.prepare(
    "SELECT * FROM cast_sessions WHERE session_id = ?",
  )
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
 * Pushes a game state update to the stream-kit container.
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

  const session = await c.env.DB.prepare(
    "SELECT * FROM cast_sessions WHERE session_id = ?",
  )
    .bind(sessionId)
    .first<CastSessionRow>();

  if (!session || session.game_id !== gameId || (session.status !== "active" && session.status !== "idle")) {
    return c.json(
      { error: { code: "session_not_found", message: "Active cast session not found", status: 404 } },
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

  // Forward state to stream-kit container (best effort — don't break the response)
  const streamServerUrl = (c.env as Env & { STREAM_SERVER_URL?: string }).STREAM_SERVER_URL;
  try {
    await fetch(`${streamServerUrl}/sessions/${session.stream_session_id}/state`, {
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
 * Ends a cast session and tears down the stream-kit container.
 */
cast.delete("/sessions/:id", async (c) => {
  const sessionId = c.req.param("id");
  const gameId = c.get("gameId");

  const session = await c.env.DB.prepare(
    "SELECT * FROM cast_sessions WHERE session_id = ?",
  )
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

  // Tear down stream-kit container
  const streamServerUrl = (c.env as Env & { STREAM_SERVER_URL?: string }).STREAM_SERVER_URL;
  if (session.stream_session_id) {
    await fetch(`${streamServerUrl}/sessions/${session.stream_session_id}`, {
      method: "DELETE",
    }).catch(() => {
      // Best effort teardown — session is ending regardless
    });
  }

  // Mark session as ended
  await c.env.DB.prepare(
    "UPDATE cast_sessions SET status = 'ended', updated_at = datetime('now') WHERE session_id = ?",
  )
    .bind(sessionId)
    .run();

  return c.json({ status: "ended" as const });
});

export default cast;
