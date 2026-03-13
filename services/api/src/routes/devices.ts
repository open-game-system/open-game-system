import { Hono } from "hono";
import type { Env, RegisterDeviceRequest } from "../types";

const devices = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/devices/register
 * Registers or updates a device's push token.
 */
devices.post("/register", async (c) => {
  let body: RegisterDeviceRequest;
  try {
    body = await c.req.json<RegisterDeviceRequest>();
  } catch {
    return c.json(
      { error: { code: "invalid_body", message: "Request body must be valid JSON", status: 400 } },
      400
    );
  }

  const { ogsDeviceId, platform, pushToken } = body;

  if (!ogsDeviceId || !platform || !pushToken) {
    return c.json(
      {
        error: {
          code: "missing_fields",
          message: "ogsDeviceId, platform, and pushToken are required",
          status: 400,
        },
      },
      400
    );
  }

  if (platform !== "ios" && platform !== "android") {
    return c.json(
      {
        error: {
          code: "invalid_platform",
          message: "platform must be 'ios' or 'android'",
          status: 400,
        },
      },
      400
    );
  }

  // Upsert: insert or replace on conflict
  await c.env.DB.prepare(
    `INSERT INTO devices (ogs_device_id, platform, push_token, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(ogs_device_id) DO UPDATE SET
       platform = excluded.platform,
       push_token = excluded.push_token,
       updated_at = datetime('now')`
  )
    .bind(ogsDeviceId, platform, pushToken)
    .run();

  return c.json({ deviceId: ogsDeviceId, registered: true });
});

export default devices;
